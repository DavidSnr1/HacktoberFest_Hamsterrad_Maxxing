import { apiError } from "@/lib/api";
import { getCandidateProfileRecord } from "@/lib/profile/server";

/** Downloads the current user's profile as JSON (data access request, GDPR Art. 15). */
export async function GET() {
  const record = await getCandidateProfileRecord();
  if (!record) return apiError(401, "Bitte melde dich erneut an.");
  if (!record.available) return apiError(503, "Dein Profil ist gerade nicht erreichbar.");

  return new Response(JSON.stringify(record.profile, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mein-profil.json"',
      "Cache-Control": "no-store",
    },
  });
}
