import type { TranscriptStats } from "@/lib/interview/transcript-stats";
import type { TrackConfig } from "@/lib/interview/tracks";
import type { TranscriptEntry } from "@/lib/schemas/interview";
import type { Rubric } from "./feedback-rubrics";

/** Prompt for evaluating a finished mock interview with Gemma (quality tier). */

export const feedbackSystemPrompt = `Du bist ein erfahrener Karrierecoach und bewertest Übungsinterviews von Studierenden und Berufseinsteigern.

Grundsätze:
- Bewerte ausschließlich auf Basis des Transkripts und der mitgelieferten Kennzahlen. Erfinde nichts dazu.
- Zitate müssen wörtlich aus den Aussagen des Kandidaten stammen (Zeilen mit "Kandidat:"). Halte sie kurz (höchstens 12 Wörter, ein zusammenhängender Ausschnitt) und verändere keine Wörter. Gibt es kein passendes Zitat, setze quote auf null.
- Wenn ein Kriterium im Gespräch gar nicht vorkam (z. B. der Case wurde nicht erreicht), setze score auf null und erkläre das in reasoning.
- Auch ein kurzes oder früh beendetes Gespräch wird ausgewertet. Bewerte, was gesagt wurde, und mach in den Verbesserungen konkret deutlich, wie der Kandidat ausführlicher antwortet. Lehne die Auswertung nie wegen zu wenig Material ab.
- Das Transkript stammt aus einer automatischen Spracherkennung. Einzelne falsch erkannte Wörter sind kein Fehler des Kandidaten.
- Sei ehrlich und konkret, aber wertschätzend. Sprich den Kandidaten mit "du" an.
- Verbesserungen müssen umsetzbar sein: Sag genau, was der Kandidat beim nächsten Mal anders machen soll, möglichst mit einer Beispielformulierung.
- Schreibe alle Texte auf Deutsch.`;

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function buildFeedbackPrompt(input: {
  track: TrackConfig;
  rubric: Rubric;
  transcript: TranscriptEntry[];
  stats: TranscriptStats;
  durationSeconds: number | null;
}): string {
  const { track, rubric, transcript, stats, durationSeconds } = input;

  const criteria = rubric.criteria
    .map(
      (c) => `- id "${c.id}" – ${c.title}: ${c.description}
  1 = ${c.anchors[1]}
  3 = ${c.anchors[3]}
  5 = ${c.anchors[5]}`,
    )
    .join("\n");

  const lines = transcript
    .map((e) => `[${formatClock(e.at)}] ${e.role === "candidate" ? "Kandidat" : "Interviewer"}: ${e.text}`)
    .join("\n");

  return `Bewerte das folgende Mock-Interview im Track "${track.label}" (${track.tagline}).

## Bewertungsraster (Skala 1 bis 5, ganze Zahlen)
${criteria}

## Kennzahlen (automatisch berechnet)
- Gesprächsdauer: ${durationSeconds ? `${Math.round(durationSeconds / 60)} Minuten` : "unbekannt"}
- Antworten des Kandidaten: ${stats.candidateAnswers}
- Wörter des Kandidaten: ${stats.candidateWords} (Durchschnitt ${stats.averageAnswerWords} pro Antwort, längste Antwort ${stats.longestAnswerWords})
- Erkannte Füllwörter: ${stats.fillerWords} (${stats.fillerPer100Words} pro 100 Wörter; Untergrenze, da die Spracherkennung "äh"/"ähm" oft weglässt)

## Transkript
${lines}

## Aufgabe
Gib ein JSON-Objekt zurück mit:
- criteria: genau ein Eintrag pro Kriterium oben, in derselben Reihenfolge, mit id, score (1–5 oder null), reasoning (2–3 Sätze Begründung) und quote (wörtliches Zitat des Kandidaten oder null).
- strengths: bis zu 3 konkrete Stärken, mindestens 1. Nenne nur Stärken, die das Transkript wirklich zeigt.
- improvements: genau 3 konkrete, umsetzbare Verbesserungen.
- exercise: ein konkreter Übungsvorschlag für die nächsten Tage (was, wie lange, woran man den Fortschritt merkt).
- summary: eine kurze Gesamteinschätzung in 2–3 Sätzen.`;
}
