import { z } from "zod";

import { apiError } from "@/lib/api";
import { getDisplayName } from "@/lib/profile/server";
import { exportFileName, renderResumeDocx, renderResumePdf } from "@/lib/resume/export";
import { activeVersionOf, getResumeDocument } from "@/lib/resume/repository";
import { withName } from "@/lib/resume/tracks";
import { exportFormatSchema } from "@/lib/schemas/resume";
import { getCurrentUser } from "@/lib/supabase/server";

const CONTENT_TYPES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
} as const;

const querySchema = z.object({
  format: exportFormatSchema,
  version: z.coerce.number().int().min(1).optional(),
});

/** GET so the browser can download via a plain link. */
export async function GET(request: Request, ctx: RouteContext<"/api/resume/[id]/export">) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Bitte melde dich an.");

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError(400, "Ungültige Lebenslauf-ID.");

  const searchParams = new URL(request.url).searchParams;
  const query = querySchema.safeParse({
    format: searchParams.get("format") ?? undefined,
    version: searchParams.get("version") ?? undefined,
  });
  if (!query.success) return apiError(400, "Ungültiges Exportformat.");

  try {
    const [doc, name] = await Promise.all([getResumeDocument(id), getDisplayName()]);
    if (!doc) return apiError(404, "Lebenslauf nicht gefunden.");
    const version =
      query.data.version !== undefined
        ? doc.versions.find((v) => v.version === query.data.version && v.status === "accepted")
        : activeVersionOf(doc);
    if (!version) return apiError(404, "Diese Version gibt es nicht.");

    const { format } = query.data;
    const content = withName(version.content, name);
    const file = format === "docx" ? await renderResumeDocx(content) : await renderResumePdf(content);
    const fileName = exportFileName(content, format);

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPES[format],
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return apiError(500, "Der Export ist fehlgeschlagen.");
  }
}
