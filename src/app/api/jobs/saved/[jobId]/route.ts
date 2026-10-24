import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiOk } from "@/lib/api";
import { unsaveJob } from "@/lib/jobs/saved";
import { getCurrentUser } from "@/lib/supabase/server";

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/jobs/saved/[jobId]">) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Bitte melde dich an.");

  const { jobId } = await ctx.params;
  if (!z.uuid().safeParse(jobId).success) return apiError(400, "Ungültige Stellen-ID.");

  try {
    await unsaveJob(jobId);
    return apiOk({ saved: false });
  } catch {
    return apiError(500, "Die Stelle konnte nicht entfernt werden.");
  }
}
