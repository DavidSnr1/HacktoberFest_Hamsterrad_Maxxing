import { z } from "zod";

import { apiError, apiOk, readJson } from "@/lib/api";
import { hasConsent } from "@/lib/consent/server";
import { diffResumes } from "@/lib/resume/diff";
import { reviseResume } from "@/lib/resume/generate";
import { getResumeProfile } from "@/lib/resume/profile-source";
import { activeVersionOf, createDraftVersion, getResumeDocument } from "@/lib/resume/repository";
import { reviseResumeInputSchema } from "@/lib/schemas/resume";
import { getCurrentUser } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(request: Request, ctx: RouteContext<"/api/resume/[id]/revise">) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Bitte melde dich an.");

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError(400, "Ungültige Lebenslauf-ID.");

  const parsed = reviseResumeInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");

  if (!(await hasConsent("resume"))) {
    return apiError(403, "Bitte stimme zuerst der Verarbeitung deiner Lebenslauf-Daten zu.");
  }

  const [doc, profile] = await Promise.all([getResumeDocument(id), getResumeProfile(user)]);
  if (!doc) return apiError(404, "Lebenslauf nicht gefunden.");
  const active = activeVersionOf(doc);
  if (!active) return apiError(409, "Für diesen Lebenslauf gibt es keine gültige Version.");
  if (!profile) return apiError(409, "Dein Profil konnte nicht geladen werden.");

  let revision;
  try {
    revision = await reviseResume(profile, active.content, {
      instruction: parsed.data.instruction,
      track: doc.track,
    });
  } catch {
    return apiError(502, "Die Änderung konnte gerade nicht umgesetzt werden. Versuch es gleich noch einmal.");
  }

  const changes = diffResumes(active.content, revision.resume);
  if (changes.length === 0) return apiOk({ version: null, note: revision.note, changes });

  try {
    const version = await createDraftVersion(id, {
      content: revision.resume,
      instruction: parsed.data.instruction,
      notes: revision.note,
    });
    return apiOk({ version, note: revision.note, changes });
  } catch {
    return apiError(500, "Die Änderung konnte nicht gespeichert werden.");
  }
}
