import type { Enums } from "@/lib/supabase/database.types";

export type ConsentType = Enums<"consent_type">;

/**
 * Bump this when a consent text changes materially. Users who agreed to an
 * older version are asked again before their next recording or upload.
 */
export const CONSENT_POLICY_VERSION = "2026-10-24";

type ConsentText = {
  title: string;
  intro: string;
  points: string[];
  checkboxLabel: string;
  confirmLabel: string;
};

// Draft wording; to be reviewed together with the privacy policy.
export const CONSENT_TEXTS: Record<ConsentType, ConsentText> = {
  voice: {
    title: "Einwilligung zur Sprachaufnahme",
    intro:
      "Für Mock-Interviews und das Einsprechen deiner Erfahrungen nutzen wir dein Mikrofon. Deine Stimme ist ein personenbezogenes Datum, deshalb brauchen wir deine Zustimmung.",
    points: [
      "Deine Sprache wird live an unseren Sprachdienst ElevenLabs übertragen, damit der Interviewer antworten und deine Aussagen in Text umgewandelt werden können.",
      "Wir speichern keine Audioaufnahmen dauerhaft, sondern nur das Transkript.",
      "Das Transkript wird zur Auswertung an Google (Gemini API) übermittelt. Daraus entsteht dein Feedback.",
      "Du kannst deine Einwilligung jederzeit widerrufen und deine Daten löschen.",
    ],
    checkboxLabel:
      "Ich willige ein, dass meine Sprache wie beschrieben verarbeitet wird.",
    confirmLabel: "Zustimmen und fortfahren",
  },
  resume: {
    title: "Einwilligung zur Verarbeitung deines Lebenslaufs",
    intro:
      "Dein Lebenslauf enthält personenbezogene Daten. Damit wir ihn analysieren und an Stellenanzeigen anpassen können, brauchen wir deine Zustimmung.",
    points: [
      "Wir lesen den Text aus deiner Datei (PDF oder DOCX, max. 5 MB) aus und speichern nur diesen Text, nicht die Datei selbst.",
      "Der Text wird zur Analyse und zum Zuschneiden an Google (Gemini API) übermittelt.",
      "Die KI nutzt ausschließlich deine Angaben und erfindet nichts hinzu.",
      "Du kannst deine Einwilligung jederzeit widerrufen und deine Daten löschen.",
    ],
    checkboxLabel:
      "Ich willige ein, dass mein Lebenslauf wie beschrieben verarbeitet wird.",
    confirmLabel: "Zustimmen und fortfahren",
  },
};
