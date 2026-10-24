import { z } from "zod";

import { apiError, apiOk, readJson } from "@/lib/api";
import { diffResumes, mergeResumes } from "@/lib/resume/diff";
import { activeVersionOf, draftVersionOf, getResumeDocument, resolveDraftVersion } from "@/lib/resume/repository";
import { decideRevisionInputSchema } from "@/lib/schemas/resume";
import { getCurrentUser } from "@/lib/supabase/server";

const bodySchema = decideRevisionInputSchema.extend({ version: z.int().min(1) });

/** Accept a subset of the open draft's changes; an empty list rejects the draft. */
export async function POST(request: Request, ctx: RouteContext<"/api/resume/[id]/draft">) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Bitte melde dich an.");

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError(400, "Ungültige Lebenslauf-ID.");

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "Ungültige Eingabe.");

  try {
    const doc = await getResumeDocument(id);
    if (!doc) return apiError(404, "Lebenslauf nicht gefunden.");
    const active = activeVersionOf(doc);
    const draft = draftVersionOf(doc);
    if (!active || !draft || draft.version !== parsed.data.version) {
      return apiError(409, "Dieser Vorschlag ist nicht mehr aktuell. Lade die Seite neu.");
    }

    const known = new Set(diffResumes(active.content, draft.content).map((c) => c.id));
    const accepted = parsed.data.acceptedChangeIds.filter((changeId) => known.has(changeId));
    const merged = accepted.length > 0 ? mergeResumes(active.content, draft.content, accepted) : null;

    await resolveDraftVersion(id, draft.version, merged);
    return apiOk({ activeVersion: merged ? draft.version : active.version });
  } catch {
    return apiError(500, "Die Entscheidung konnte nicht gespeichert werden.");
  }
}
