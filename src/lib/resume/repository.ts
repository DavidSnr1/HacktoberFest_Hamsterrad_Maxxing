import "server-only";

import {
  resumeSchema,
  resumeTrackSchema,
  type Resume,
  type ResumeLanguage,
  type ResumeTrack,
} from "@/lib/schemas/resume";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// All access runs as the signed-in user, so RLS limits every query to own rows.

async function db() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

export type ResumeVersionStatus = "draft" | "accepted" | "rejected";

export type ResumeDocumentSummary = {
  id: string;
  track: ResumeTrack;
  targetRole: string;
  language: ResumeLanguage;
  activeVersion: number;
  updatedAt: string;
};

export type ResumeVersion = {
  version: number;
  status: ResumeVersionStatus;
  instruction: string | null;
  notes: string | null;
  createdAt: string;
  content: Resume;
};

export type ResumeDocument = ResumeDocumentSummary & {
  versions: ResumeVersion[];
};

type DocumentRow = {
  id: string;
  track: string;
  target_role: string;
  language: string;
  active_version: number;
  updated_at: string;
};

function toSummary(row: DocumentRow): ResumeDocumentSummary {
  return {
    id: row.id,
    track: resumeTrackSchema.parse(row.track),
    targetRole: row.target_role,
    language: row.language === "en" ? "en" : "de",
    activeVersion: row.active_version,
    updatedAt: row.updated_at,
  };
}

function toJson(resume: Resume): Json {
  return resume as unknown as Json;
}

const SUMMARY_COLUMNS = "id, track, target_role, language, active_version, updated_at";

/** The user's resumes (at most one per track). */
export async function listResumeDocuments(): Promise<ResumeDocumentSummary[]> {
  const supabase = await db();
  const { data, error } = await supabase.from("resume_documents").select(SUMMARY_COLUMNS);
  if (error) throw error;
  return data.map(toSummary);
}

export async function findResumeDocumentByTrack(track: ResumeTrack): Promise<ResumeDocumentSummary | null> {
  const supabase = await db();
  const { data, error } = await supabase.from("resume_documents").select(SUMMARY_COLUMNS).eq("track", track).maybeSingle();
  if (error) throw error;
  return data ? toSummary(data) : null;
}

/** Document with all versions (incl. rejected, for the chat history), newest first. Null if it doesn't exist or isn't the user's. */
export async function getResumeDocument(id: string): Promise<ResumeDocument | null> {
  const supabase = await db();
  const { data: doc, error } = await supabase.from("resume_documents").select(SUMMARY_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!doc) return null;

  const { data: versions, error: versionsError } = await supabase
    .from("resume_versions")
    .select("version, status, instruction, notes, created_at, content")
    .eq("document_id", id)
    .order("version", { ascending: false });
  if (versionsError) throw versionsError;

  return {
    ...toSummary(doc),
    versions: versions.flatMap((v) => {
      const content = resumeSchema.safeParse(v.content);
      if (!content.success) return [];
      return [
        {
          version: v.version,
          status: v.status as ResumeVersionStatus,
          instruction: v.instruction,
          notes: v.notes,
          createdAt: v.created_at,
          content: content.data,
        },
      ];
    }),
  };
}

export function activeVersionOf(doc: ResumeDocument): ResumeVersion | null {
  return doc.versions.find((v) => v.version === doc.activeVersion && v.status === "accepted") ?? null;
}

export function draftVersionOf(doc: ResumeDocument): ResumeVersion | null {
  return doc.versions.find((v) => v.status === "draft") ?? null;
}

export class ResumeTrackTakenError extends Error {}

export async function createResumeDocument(input: {
  track: ResumeTrack;
  targetRole: string;
  language: ResumeLanguage;
  content: Resume;
}): Promise<{ id: string }> {
  const supabase = await db();
  const { data: doc, error } = await supabase
    .from("resume_documents")
    .insert({ track: input.track, target_role: input.targetRole, language: input.language, active_version: 1 })
    .select("id")
    .single();
  // 23505 = unique violation: a resume for this track was created in parallel.
  if (error?.code === "23505") throw new ResumeTrackTakenError();
  if (error) throw error;

  const { error: versionError } = await supabase
    .from("resume_versions")
    .insert({ document_id: doc.id, version: 1, content: toJson(input.content), status: "accepted" });
  if (versionError) {
    await supabase.from("resume_documents").delete().eq("id", doc.id);
    throw versionError;
  }
  return { id: doc.id };
}

async function nextVersion(documentId: string): Promise<number> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("resume_versions")
    .select("version")
    .eq("document_id", documentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.version ?? 0) + 1;
}

async function discardDraft(documentId: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("resume_versions").delete().eq("document_id", documentId).eq("status", "draft");
  if (error) throw error;
}

/**
 * Stores a new accepted version and makes it active (regenerated resume or new
 * role). An open chat draft is discarded – it was based on the old version.
 */
export async function addAcceptedVersion(
  documentId: string,
  input: { content: Resume; notes: string },
): Promise<number> {
  await discardDraft(documentId);
  const version = await nextVersion(documentId);
  const supabase = await db();
  const { error } = await supabase.from("resume_versions").insert({
    document_id: documentId,
    version,
    content: toJson(input.content),
    notes: input.notes,
    status: "accepted",
  });
  if (error) throw error;

  const { error: docError } = await supabase
    .from("resume_documents")
    .update({ active_version: version, target_role: input.content.targetRole, language: input.content.language })
    .eq("id", documentId);
  if (docError) throw docError;
  return version;
}

/** Stores a chat revision as the (single) open draft, replacing an older draft. */
export async function createDraftVersion(
  documentId: string,
  input: { content: Resume; instruction: string; notes: string },
): Promise<number> {
  await discardDraft(documentId);
  const version = await nextVersion(documentId);
  const supabase = await db();
  const { error } = await supabase.from("resume_versions").insert({
    document_id: documentId,
    version,
    content: toJson(input.content),
    instruction: input.instruction,
    notes: input.notes,
    status: "draft",
  });
  if (error) throw error;
  return version;
}

/** Closes the draft: `merged` = accepted content (becomes active), null = rejected entirely. */
export async function resolveDraftVersion(documentId: string, version: number, merged: Resume | null): Promise<void> {
  const supabase = await db();
  const { error } = await supabase
    .from("resume_versions")
    .update(merged ? { status: "accepted", content: toJson(merged) } : { status: "rejected" })
    .eq("document_id", documentId)
    .eq("version", version)
    .eq("status", "draft");
  if (error) throw error;
  if (merged) await setActiveVersion(documentId, version, merged);
}

/** Switches to another accepted version; role and language follow that version. */
export async function setActiveVersion(documentId: string, version: number, content: Resume): Promise<void> {
  const supabase = await db();
  const { error } = await supabase
    .from("resume_documents")
    .update({ active_version: version, target_role: content.targetRole, language: content.language })
    .eq("id", documentId);
  if (error) throw error;
}

export async function deleteResumeDocument(id: string): Promise<boolean> {
  const supabase = await db();
  const { data, error } = await supabase.from("resume_documents").delete().eq("id", id).select("id");
  if (error) throw error;
  return data.length > 0;
}
