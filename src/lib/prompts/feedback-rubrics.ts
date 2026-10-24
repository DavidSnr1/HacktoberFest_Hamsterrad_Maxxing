import type { InterviewTrack } from "@/lib/interview/tracks";

/**
 * Feedback rubrics (scale 1-5). Kept as plain data so domain experts can
 * refine wording, anchors and weights without touching code.
 * Bump RUBRIC_VERSION whenever criteria change; it is stored with each feedback.
 */
export const RUBRIC_VERSION = "2026-10-24";

export type RubricCriterion = {
  /** Stable id, stored in the database. Do not rename. */
  id: string;
  title: string;
  /** What the evaluator should look at. */
  description: string;
  /** What a 1, 3 and 5 look like; the model interpolates 2 and 4. */
  anchors: { 1: string; 3: string; 5: string };
  /** Relative weight in the overall score. */
  weight: number;
};

const COMMON_CRITERIA: RubricCriterion[] = [
  {
    id: "structure",
    title: "Struktur und Klarheit",
    description:
      "Sind die Antworten logisch aufgebaut (z. B. Kernaussage zuerst, klare Gliederung, STAR bei Verhaltensfragen) und leicht nachvollziehbar?",
    anchors: {
      1: "Sprunghaft, keine erkennbare Ordnung, Kernaussage fehlt.",
      3: "Grundstruktur erkennbar, aber Umwege oder unklare Übergänge.",
      5: "Durchgehend klar gegliedert, Kernaussage vorne, roter Faden.",
    },
    weight: 1,
  },
  {
    id: "depth",
    title: "Inhaltliche Tiefe und Korrektheit",
    description:
      "Gehen die Antworten über Oberflächliches hinaus, sind sie fachlich korrekt und beantworten sie die gestellte Frage?",
    anchors: {
      1: "Oberflächlich, an der Frage vorbei oder fachlich falsch.",
      3: "Solide, aber teilweise allgemein oder mit kleinen Fehlern.",
      5: "Tiefgehend, präzise, fachlich korrekt und auf die Frage zugeschnitten.",
    },
    weight: 1,
  },
  {
    id: "persuasion",
    title: "Überzeugungskraft und Beispiele",
    description:
      "Werden Aussagen mit konkreten Beispielen, Ergebnissen und Zahlen belegt? Wird die eigene Rolle klar?",
    anchors: {
      1: "Nur Behauptungen, keine Beispiele oder Ergebnisse.",
      3: "Beispiele vorhanden, aber Ergebnisse oder eigene Rolle bleiben vage.",
      5: "Konkrete Beispiele mit messbaren Ergebnissen und klarer eigener Rolle.",
    },
    weight: 1,
  },
  {
    id: "delivery",
    title: "Sprechweise",
    description:
      "Prägnanz, Füllwörter, Länge der Antworten. Bewerte nur, was im Transkript und in den mitgelieferten Kennzahlen sichtbar ist; Tonfall und Tempo sind aus dem Text nicht sicher ableitbar.",
    anchors: {
      1: "Sehr viele Füllwörter, ausschweifend oder extrem knapp.",
      3: "Einige Füllwörter oder Längen, insgesamt verständlich.",
      5: "Prägnant, kaum Füllwörter, angemessene Antwortlänge.",
    },
    weight: 1,
  },
];

const TRACK_CRITERIA: Record<InterviewTrack, RubricCriterion> = {
  consulting: {
    id: "case_structure",
    title: "Case-Struktur",
    description:
      "Wie gut wird der Case gelöst: Strukturierung des Problems (z. B. Gewinnbaum), gezielte Fragen nach Daten, korrekte Rechnung, Synthese und Empfehlung?",
    anchors: {
      1: "Keine Struktur, keine Rechnung oder kein Ergebnis.",
      3: "Brauchbare Struktur, aber Lücken bei Daten, Rechnung oder Empfehlung.",
      5: "MECE-Struktur, zielgerichtete Analyse, saubere Rechnung, klare Empfehlung.",
    },
    weight: 1.5,
  },
  finance: {
    id: "technical_knowledge",
    title: "Fachwissen Finance",
    description:
      "Korrektheit und Sicherheit bei Accounting, Bewertung (DCF, Multiples), Marktthemen und Deal-Fragen.",
    anchors: {
      1: "Grundbegriffe falsch oder unbekannt.",
      3: "Grundlagen sitzen, bei Vertiefung Unsicherheiten.",
      5: "Sicher und präzise, auch bei Nachfragen und Zusammenhängen.",
    },
    weight: 1.5,
  },
  startup: {
    id: "ownership",
    title: "Ownership",
    description:
      "Zeigt der Kandidat Eigeninitiative, Verantwortung für Ergebnisse, pragmatisches Priorisieren und Produktdenken unter Unsicherheit?",
    anchors: {
      1: "Wartet auf Vorgaben, schiebt Verantwortung ab.",
      3: "Übernimmt Verantwortung, aber wenig eigene Initiative oder Priorisierung.",
      5: "Treibt Themen selbst, priorisiert klar, denkt in Wirkung für Nutzer.",
    },
    weight: 1.5,
  },
};

export type Rubric = { version: string; criteria: RubricCriterion[] };

export function getRubric(track: InterviewTrack): Rubric {
  return { version: RUBRIC_VERSION, criteria: [...COMMON_CRITERIA, TRACK_CRITERIA[track]] };
}
