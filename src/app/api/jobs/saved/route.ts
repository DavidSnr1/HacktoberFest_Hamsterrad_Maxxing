import { z } from "zod";

import { apiError, apiOk, readJson } from "@/lib/api";
import { listSavedJobs, saveJob } from "@/lib/jobs/saved";
import { getCurrentUser } from "@/lib/supabase/server";

const saveBodySchema = z.object({ jobId: z.uuid() });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Bitte melde dich an.");

  try {
    return apiOk({ postings: await listSavedJobs() });
  } catch {
    return apiError(500, "Deine gemerkten Stellen konnten nicht geladen werden.");
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Bitte melde dich an.");

  const body = saveBodySchema.safeParse(await readJson(request));
  if (!body.success) return apiError(400, "Ungültige Stellen-ID.");

  try {
    const result = await saveJob(body.data.jobId);
    if (result === "not_found") return apiError(404, "Diese Stelle wurde nicht gefunden.");
    return apiOk({ saved: true });
  } catch {
    return apiError(500, "Die Stelle konnte nicht gemerkt werden.");
  }
}
