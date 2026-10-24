import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ResumeWorkspace } from "@/components/resume/resume-workspace";
import { hasConsent } from "@/lib/consent/server";
import { getDisplayName } from "@/lib/profile/server";
import { diffResumes } from "@/lib/resume/diff";
import { activeVersionOf, draftVersionOf, getResumeDocument } from "@/lib/resume/repository";
import { TRACK_TEMPLATES, withName } from "@/lib/resume/tracks";

export const metadata: Metadata = {
  title: "Lebenslauf",
};

export default async function ResumeDetailPage({ params }: PageProps<"/resume/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [doc, consentGranted, name] = await Promise.all([getResumeDocument(id), hasConsent("resume"), getDisplayName()]);
  if (!doc) notFound();

  const active = activeVersionOf(doc);
  const draft = draftVersionOf(doc);
  const changes = active && draft ? diffResumes(active.content, draft.content) : [];

  return (
    <div className="space-y-6">
      <Link href="/resume" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden />
        Alle Lebensläufe
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{TRACK_TEMPLATES[doc.track].label}-Lebenslauf</h1>
      {/* Remount on a new active version so the version picker and inputs start fresh. */}
      <ResumeWorkspace
        key={doc.activeVersion}
        id={doc.id}
        track={doc.track}
        targetRole={doc.targetRole}
        language={doc.language}
        activeVersion={doc.activeVersion}
        versions={doc.versions.map((v) => ({ ...v, content: withName(v.content, name) }))}
        draft={draft && changes.length > 0 ? { version: draft.version, note: draft.notes, changes } : null}
        consentGranted={consentGranted}
      />
    </div>
  );
}
