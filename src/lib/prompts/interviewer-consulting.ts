import type { InterviewScript } from "@/lib/interview/script";

/**
 * Consulting interview (one-way format): the interviewer's voice reads each
 * question aloud via ElevenLabs text-to-speech, the candidate answers on
 * camera/microphone. No follow-up questions, so the case comes with all data.
 * Spoken in German and formal ("Sie"), like a real first-round interview.
 */
export const consultingScript: InterviewScript = {
  intro:
    "Hallo und herzlich willkommen! Mein Name ist Lena Hartmann, ich bin Principal bei uns in der Strategieberatung. " +
    "Ich stelle Ihnen gleich fünf Fragen. Nach jeder Frage haben Sie kurz Zeit zum Nachdenken, danach nehmen wir Ihre Antwort auf. " +
    "Antworten Sie so, als säßen Sie mir gegenüber. Viel Erfolg!",
  questions: [
    {
      id: "intro",
      text: "Stellen Sie sich bitte kurz vor. Was haben Sie bisher gemacht, und was bringt Sie zu uns?",
      prepSeconds: 30,
      answerSeconds: 120,
    },
    {
      id: "motivation",
      text: "Warum möchten Sie in die Strategieberatung, und warum gerade zu uns?",
      prepSeconds: 30,
      answerSeconds: 120,
    },
    {
      id: "leadership",
      text:
        "Erzählen Sie von einer Situation, in der Sie Verantwortung übernommen oder ein Team geführt haben. " +
        "Was war Ihre Rolle, was haben Sie konkret getan, und was war das Ergebnis?",
      prepSeconds: 45,
      answerSeconds: 150,
    },
    {
      id: "conflict",
      text:
        "Beschreiben Sie einen Konflikt in einem Team, an dem Sie beteiligt waren. " +
        "Wie sind Sie damit umgegangen, und was haben Sie daraus gelernt?",
      prepSeconds: 45,
      answerSeconds: 150,
    },
    {
      id: "case",
      text:
        "Zum Abschluss ein kurzer Case. Unser Kunde ist FitWerk, eine Fitnessstudio-Kette mit 40 Studios in Deutschland. " +
        "Der Gewinn ist in den letzten zwei Jahren deutlich gesunken. " +
        "Vor zwei Jahren lag der Umsatz bei 48 Millionen Euro bei 80.000 Mitgliedern. Heute sind es 44 Millionen Euro bei 88.000 Mitgliedern. " +
        "Die Kosten sind im selben Zeitraum von 40 auf 42 Millionen Euro gestiegen, fast vollständig durch höhere Energiekosten. " +
        "In denselben Städten haben zwei Discount-Ketten eröffnet. " +
        "Wie gehen Sie an das Problem heran? Strukturieren Sie es, rechnen Sie laut, und geben Sie dem CEO am Ende eine kurze Empfehlung.",
      prepSeconds: 120,
      answerSeconds: 300,
    },
  ],
  outro:
    "Vielen Dank für Ihre Antworten, damit ist das Interview beendet. Ihre Auswertung wird jetzt erstellt. Alles Gute!",
};
