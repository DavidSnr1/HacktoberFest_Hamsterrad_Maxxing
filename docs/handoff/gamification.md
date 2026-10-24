# Übergabe: Feature B – Charakter / Gamification (`feature/gamification`)

Vorlage war der Klick-Prototyp `index.html` („NextStep“) mit Avatar, 20 Personas und Level-System. Er zählte XP im Browser (Buttons, `localStorage`). Hier kommen XP ausschließlich aus `xp_events` und werden nur auf dem Server vergeben.

## Entscheidungen (David, 24.10.2026)

| # | Frage | Entscheidung |
|---|---|---|
| 1 | Foto-Avatar per Gemini-Bildmodell | **Nicht bauen.** Nur der gezeichnete Avatar. |
| 2 | XP-Beträge | Bestehende Werte aus `XP_REWARDS` bleiben; Level-Grenzen und Meilensteine aus dem Prototyp kommen dazu. |
| 3 | CV-Meilensteine | Bachelor, Master und Praktikum ab 3 Monaten aus dem Profil; Spring Week und Full-Time Offer bestätigt man einmal per Klick. |
| 4 | Stress-Test (Ergebnis > 7/10 eintippen) | Ersetzt durch einen automatischen Bonus: +40 XP, wenn der Feedback-Gesamtscore eines Interviews über 3,5 von 5 liegt. |
| 5 | Tägliche Streak | +10 XP automatisch pro Tag (Europe/Berlin) mit mindestens einer XP-Aktivität. Kein Einlöse-Button. |
| 6 | Vibe | Nur die 3 Tracks, automatisch aus dem ersten Track im Profil. Marketing & Product aus dem Prototyp entfällt. |
| 7 | Design | App-Look (Navy/Serif/Messing). Avatar behält seine Farben; Header und Navigation des Prototyps entfallen. |
| 8 | Persona-Texte | Ohne Artikel, Markennamen durch allgemeine Begriffe ersetzt. |
| 9 | Badges | Sechs Vorschläge (siehe unten), zum Streichen oder Ergänzen in `badges.ts`. |
| 10 | Branch | Eigener Branch `feature/gamification`, abgezweigt von `integration/features-a-c` (5dd5f67). |

## Was gebaut wurde

- **`/character`** (`src/app/(app)/character/page.tsx`): Avatar mit Level-Titel, Spruch, XP-Balken und Streak; Quests (CV-Meilensteine und Training); Badges; letzte acht XP-Events; Galerie aller 15 Personas.
- **Avatar** (`src/components/character/avatar.tsx`, `avatar.css`, `avatar-looks.ts`): Die CSS-Figur aus dem Prototyp. Outfit und Requisiten pro Vibe und Level stehen in `AVATAR_LOOKS`. Das CSS ist global mit Präfix `av-`, weil `next.config.ts` alle `*.css` als normales CSS lädt; CSS-Module funktionieren in diesem Projekt deshalb nicht.
- **Level-up**: `profiles.last_seen_level` merkt sich das zuletzt gezeigte Level. Steigt es, pulsiert der Avatar und es erscheint ein Toast; danach speichert `markLevelSeen` das Level, das der Server selbst berechnet. Beim ersten Besuch wird nur gespeichert, nicht gefeiert. `prefers-reduced-motion` schaltet die Animation ab.

## Logik (`src/lib/gamification/`)

| Datei | Inhalt |
|---|---|
| `levels.ts` | `LEVEL_THRESHOLDS`, `levelFromXp`, `xpForLevel`, `levelProgress` |
| `personas.ts` | Vibe aus Profil-Tracks, 15 Personas (Titel = Level-Titel) |
| `streak.ts` | aktuelle und längste Serie aus Tagen mit XP-Events (Europe/Berlin) |
| `milestones.ts` | 5 Meilensteine mit fester `ref_id`; `profileMilestones` liest nur **bestätigte** Profilwerte (wie der Lebenslauf) |
| `badges.ts` | Badge-Liste mit Bedingungen; wird bei jedem Aufruf abgeleitet, nicht gespeichert |
| `xp.ts` | `XP_REWARDS` (neu: `dailyStreak`, `interviewBonus`), `awardXp` vergibt zusätzlich die Tages-Streak |
| `xp-labels.ts` | deutsche Bezeichnungen der Event-Typen |
| `server.ts` | `getCharacterState` lädt alles für die Seite und vergibt fehlende Profil-Meilensteine |
| `actions.ts` | `claimMilestone` (nur Spring Week/Offer), `markLevelSeen` |

Badges: Erstes Interview · Allrounder (alle 3 Tracks; erst erreichbar, wenn Finance und Startup in `tracks.ts` aktiv sind) · Sieben Tage am Stück · Top-Score (≥ 4/5) · Maßgeschneidert (erster zugeschnittener Lebenslauf) · Profil komplett.

## Datenbank

- `20261102100000_gamification_xp_event_types.sql`: Enum-Werte `milestone`, `interview_bonus`.
- `20261102100100_gamification_streak_and_level.sql`: eindeutiger Index für höchstens ein `daily_streak` pro Nutzer und Berliner Kalendertag (TEAM-KONTEXT 4B.3); Spalte `profiles.last_seen_level` (1–5).
- Beide sind auf dem gemeinsamen Supabase-Projekt eingespielt. `database.types.ts` wurde von Hand ergänzt.

## Änderungen außerhalb von Feature B

- `src/lib/interview/feedback.ts`: nach dem Feedback-XP zusätzlich `awardXp(..., "interview_bonus", ...)` bei Score > 3,5. Drei Zeilen; beim Merge mit `integration/features-a-c` auf Konflikte achten, dort wird die Datei gerade weiter bearbeitet.

## Bekannte Grenzen

- Profil-Meilensteine werden beim Öffnen von `/character` vergeben, nicht sofort beim Speichern des Profils. Wer einen Abschluss später löscht, behält die XP.
- XP-Events werden mit höchstens 1.000 Zeilen pro Nutzer gelesen (PostgREST-Grenze); das reicht weit.
- Die Level-Anzeige im Header ist nicht gebaut (TEAM-KONTEXT: nicht im Scope).

## Selbst testen

1. `npm run dev`, einloggen, `/character` öffnen.
2. Im Profil einen Bachelor bestätigen und `/character` neu laden: Meilenstein abgehakt, +50 XP, dazu +10 XP Streak.
3. „Geschafft“ bei Spring Week: Dialog, nach dem Bestätigen +100 XP.
4. Ein Interview abschließen: +100 XP plus Feedback-XP, bei Score > 3,5 der Stark-Bonus.
5. Level-up erzwingen: im SQL-Editor `update profiles set last_seen_level = 1 where id = '<deine id>';` und Seite neu laden.
