import "server-only";

import type { ExportFormat, Resume } from "@/lib/schemas/resume";

export { renderResumeDocx } from "./docx";
export { renderResumePdf } from "./pdf";

const TRANSLITERATION: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" };

function slug(text: string, maxLength: number): string {
  return text
    .replace(/[äöüÄÖÜß]/g, (c) => TRANSLITERATION[c])
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, maxLength)
    .replace(/-+$/, "");
}

/** ASCII-only, e.g. "Lebenslauf_Lena-Becker_Werkstudent-Strategy-Consulting.pdf". */
export function exportFileName(resume: Resume, format: ExportFormat): string {
  const prefix = resume.language === "de" ? "Lebenslauf" : "CV";
  const parts = [prefix, slug(resume.header.name ?? "", 40), slug(resume.targetRole, 50)].filter(Boolean);
  return `${parts.join("_")}.${format}`;
}
