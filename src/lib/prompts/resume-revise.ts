import type { LlmResumeDraft, ResumeLanguage, ResumeProfile, ResumeTrack } from "@/lib/schemas/resume";

import { RESUME_RULES, trackContext } from "./resume-generate";

export const RESUME_REVISE_SYSTEM = `Du überarbeitest einen bestehenden Lebenslauf nach der Anweisung der Person. Der Lebenslauf ist auf einen Bereich zugeschnitten (Finance, Consulting oder Startup) und bleibt das auch.

${RESUME_RULES}

Zusätzlich:
- Ändere nur, was die Anweisung verlangt. Alles andere bleibt exakt gleich, inklusive aller IDs.
- Behalte die IDs bestehender Einträge bei, auch wenn du sie verschiebst oder umformulierst. Neue Einträge bekommen neue IDs.
- Verlangt die Anweisung etwas, das das Profil nicht hergibt (z. B. eine Erfahrung, die es nicht gibt), ändere dazu nichts und erkläre es in "note".
- "note": 1–2 Sätze auf Deutsch in Du-Form, was du geändert hast.`;

export function buildResumeRevisePrompt(input: {
  profile: ResumeProfile;
  current: LlmResumeDraft;
  instruction: string;
  track: ResumeTrack;
  language: ResumeLanguage;
}): string {
  return `${trackContext(input.track, input.language)}

Profil (JSON):
"""
${JSON.stringify(input.profile)}
"""

Aktueller Lebenslauf (JSON):
"""
${JSON.stringify(input.current)}
"""

Anweisung der Person:
"""
${input.instruction}
"""

Gib den vollständigen überarbeiteten Lebenslauf und "note" im vorgegebenen JSON-Schema zurück.`;
}
