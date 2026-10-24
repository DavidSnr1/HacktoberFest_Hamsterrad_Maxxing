import type { NextRequest } from "next/server";

import { apiError, apiOk } from "@/lib/api";
import { consumeSearchQuota } from "@/lib/jobs/rate-limit";
import { searchJobs } from "@/lib/jobs/search";
import { jobSearchParamsSchema } from "@/lib/schemas/job-posting";
import { getCurrentUser } from "@/lib/supabase/server";

// Several external sources are queried in parallel; give them time.
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Bitte melde dich an.");

  const searchParams = request.nextUrl.searchParams;
  const parsed = jobSearchParamsSchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    track: searchParams.get("track") || undefined,
    type: searchParams.get("type") || undefined,
  });
  if (!parsed.success) return apiError(400, "Die Suchangaben sind ungültig.");
  if (!parsed.data.q && !parsed.data.location && !parsed.data.track && !parsed.data.type) {
    return apiError(400, "Gib einen Suchbegriff, einen Ort oder einen Filter an.");
  }

  try {
    if (!(await consumeSearchQuota())) {
      return apiError(429, "Zu viele Suchen in kurzer Zeit. Warte kurz und versuch es dann noch einmal.");
    }
    return apiOk(await searchJobs(parsed.data));
  } catch {
    return apiError(500, "Die Suche ist gerade fehlgeschlagen. Bitte versuch es später noch einmal.");
  }
}
