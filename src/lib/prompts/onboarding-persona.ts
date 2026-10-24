/**
 * Persona of the onboarding chatbot: a friendly BWL cliché (consulting
 * associate in a fleece vest). Scripted lines, no LLM involved, so the chat
 * answers instantly and nothing is invented. Visible texts in German, "du".
 */

import type { OnboardingStepId } from "@/lib/onboarding/steps";

export const onboardingPersona = {
  name: "Maximilian",
  role: "Associate, Strategieberatung (2. Jahr)",
  intro: [
    "Servus! Ich bin Maximilian, Associate im zweiten Jahr. Die Patagonia-Weste war quasi Teil meines Onboarding-Pakets.",
    "Bevor du richtig loslegst, machen wir ein kurzes Alignment zu deinem Profil. Ich time-boxe das auf zehn Minuten, versprochen.",
    "Alles, was du mir sagst, nutzt die App, um Interviews, Lebenslauf und Stellenvorschläge auf dich zuzuschneiden. Du kannst jede Frage überspringen.",
  ],
  questions: {
    education:
      "Lass uns bottom-up starten: Was studierst du gerade, oder was hast du zuletzt abgeschlossen?",
    experience:
      "Jetzt zum Track Record: Welche Praxiserfahrung hast du? Praktika, Werkstudentenjobs, Nebenjobs, alles zählt. Notier zu jeder Station kurz, was du dort gemacht hast. Daraus werden später die Bulletpoints in deinem Lebenslauf.",
    projects:
      "Gab es Projekte, auf die du stolz bist? Uni-Projekte, Case Competitions, Hackathons oder eigene Side Projects. Auch hier gilt: kurz festhalten, was du beigetragen hast.",
    volunteering:
      "Und neben Uni und Job: Engagierst du dich ehrenamtlich? Fachschaft, Studierendeninitiative, Verein oder Ähnliches. Das zeigt Leadership, und Leadership ist bei uns quasi Währung.",
    location: "Wo bist du aktuell basiert?",
    tracks: "Jetzt zum Big Picture: Wo siehst du dich? Mehrfachauswahl ist erlaubt, Optionalität ist schließlich auch ein Wert.",
    employmentTypes: "Welche Art von Rolle suchst du gerade?",
    preferredLocations: "In welchen Städten würdest du gern arbeiten? Gib mir gern mehrere, ich mag Long Lists.",
    remoteOk: "Remote oder hybrid: okay für dich?",
    earliestStart: "Ab wann könntest du frühestens starten?",
    skills: "Was sind deine Hard Skills? Excel, PowerPoint, SQL, Python: Gib mir die Highlights.",
    languages: "Letzte Frage, dann sind wir durch: Welche Sprachen sprichst du, und auf welchem Niveau?",
  } satisfies Record<OnboardingStepId, string>,
  /** Short reactions after an answer; picked by question index, so they vary. */
  acknowledgements: [
    "Sehr gut, notiert.",
    "Spannend. Das gefällt mir.",
    "Klingt nach High Potential.",
    "Top, das nehme ich so mit.",
    "Perfekt, ist im Deck.",
    "Sauber. Weiter geht's.",
  ],
  skipped: "Kein Thema, das parken wir erstmal.",
  outro: [
    "Das war's schon. Damit haben wir ein sauberes Profil, quasi deine Single Source of Truth.",
    "Du kannst alles jederzeit unter „Mein Profil“ anpassen. Und jetzt: Let's go!",
  ],
} as const;
