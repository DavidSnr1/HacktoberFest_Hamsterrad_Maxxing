import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiOk } from "@/lib/api";
import { getJobOutlook } from "@/lib/jobs/outlook";
import { getJobPosting } from "@/lib/jobs/search";
import { getCurrentUser } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/jobs/[id]/outlook">) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Bitte melde dich an.");

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError(400, "Ungültige Stellen-ID.");

  const posting = await getJobPosting(id);
  if (!posting) return apiError(404, "Diese Stelle wurde nicht gefunden.");
  return apiOk({ outlook: await getJobOutlook(posting) });
}
