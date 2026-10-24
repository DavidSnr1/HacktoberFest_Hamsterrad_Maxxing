import { z } from "zod";

import { apiError, apiOk, readJson } from "@/lib/api";
import {
  activeVersionOf,
  addAcceptedVersion,
  deleteResumeDocument,
  getResumeDocument,
  setActiveVersion,
} from "@/lib/resume/repository";
import { withRole } from "@/lib/resume/tracks";
import { updateResumeDocumentInputSchema } from "@/lib/schemas/resume";
import { getCurrentUser } from "@/lib/supabase/server";

/** Takes over a new role (new version, content unchanged) or switches to another version. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/resume/[id]">) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Bitte melde dich an.");

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError(400, "Ungültige Lebenslauf-ID.");

  const parsed = updateResumeDocumentInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  const { targetRole, activeVersion } = parsed.data;

  try {
    const doc = await getResumeDocument(id);
    if (!doc) return apiError(404, "Lebenslauf nicht gefunden.");

    if (targetRole !== undefined) {
      const active = activeVersionOf(doc);
      if (!active) return apiError(409, "Für diesen Lebenslauf gibt es keine gültige Version.");
      if (active.content.targetRole === targetRole) return apiOk({ activeVersion: active.version });
      const version = await addAcceptedVersion(id, {
        content: withRole(active.content, targetRole),
        notes: `Rolle übernommen: „${targetRole}“.`,
      });
      return apiOk({ activeVersion: version });
    }

    const target = doc.versions.find((v) => v.version === activeVersion && v.status === "accepted");
    if (!target) return apiError(400, "Diese Version gibt es nicht.");
    await setActiveVersion(id, target.version, target.content);
    return apiOk({ activeVersion: target.version });
  } catch {
    return apiError(500, "Der Lebenslauf konnte nicht gespeichert werden.");
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/resume/[id]">) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Bitte melde dich an.");

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError(400, "Ungültige Lebenslauf-ID.");

  try {
    const deleted = await deleteResumeDocument(id);
    if (!deleted) return apiError(404, "Lebenslauf nicht gefunden.");
    return apiOk({ deleted: true });
  } catch {
    return apiError(500, "Der Lebenslauf konnte nicht gelöscht werden.");
  }
}
