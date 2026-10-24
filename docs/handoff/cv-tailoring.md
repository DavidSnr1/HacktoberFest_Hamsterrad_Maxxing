# Übergabe: Feature A – Lebenslauf erstellen, anpassen & zuschneiden (`feature/cv-tailoring`)

## ⚠️ Zuerst lesen: Abweichung von TEAM-KONTEXT 4A

Das Feature wurde neu ausgerichtet. Die Daten über die Person werden **nicht** hier gesammelt, sondern beim Login/Onboarding. Sie liegen dann als JSON im Profilformat vor (siehe „Profilformat“ unten); wo genau sie gespeichert werden, ist noch offen. Dieses Feature **verarbeitet** sie nur noch.

- **Drei Lebensläufe pro Nutzer:** je einer für **Finance**, **Consulting** und **Startup**. Der Bereich legt Aufbau (Reihenfolge und Titel der Abschnitte) und Zuschnitt (Schwerpunkte, Ton) fest. Die Rolle, auf die man sich bewirbt („Werkstudent M&A“), steht als Zeile unter dem Namen im Lebenslauf.
- Gibt man eine neue Rolle für einen Bereich ein, wird sie in den bestehenden Lebenslauf dieses Bereichs übernommen; es entsteht kein vierter Lebenslauf.
- **Entfällt:** CV-Upload + Parsing (`/api/resume/parse`), Erfahrungen einsprechen (`/api/experience/transcribe`, ElevenLabs), Rückfragen zum Sammeln von Infos, Eingabe einer Stellenanzeige. Zugeschnitten wird auf den Bereich, nicht auf eine einzelne Anzeige.
- Die bestehenden Tabellen `resumes`, `tailored_resumes` und `experiences` werden **nicht** genutzt. Stattdessen gibt es eigene Tabellen (siehe 2). **Offene Entscheidung für Ole:** alte Tabellen behalten oder in einer späteren Migration entfernen.

## 1. Was gebaut wurde

- **`/resume`**: oben das Feld „Auf welche Rolle bewirbst du dich?“, darunter die Auswahl Finance/Consulting/Startup (wird aus der Rolle vorgeschlagen und lässt sich ändern) und die Sprache. Je nach Lage heißt der Button:
  - „Finance-Lebenslauf erstellen“: Es gibt noch keinen für den Bereich, Gemma erstellt ihn.
  - „Rolle in deinen Finance-Lebenslauf übernehmen“: Es gibt schon einen. Nur die Rolle ändert sich, kein LLM-Aufruf.
  - „Finance-Lebenslauf auf Englisch neu erstellen“: Es gibt schon einen, aber in der anderen Sprache.
  - Darunter stehen die drei Karten mit dem Stand je Bereich.
- **`/resume/[id]`**: Vorschau mit Rolle („Ändern“), Chat zum Anpassen („Kürzer, max. 1 Seite“), Änderungsansicht mit Annehmen/Ablehnen pro Änderung, Versionsauswahl, „Neu erstellen“ (mit dem aktuellen Profil), Export als PDF/DOCX, Löschen.

**Bereiche** (`src/lib/resume/tracks.ts`):
- `TRACK_TEMPLATES` legt pro Bereich die feste Abschnittsreihenfolge, die Abschnittstitel (de/en) und die Schwerpunkte für Gemma fest. Beispiel Startup: Praxiserfahrung → Projekte → Skills & Tools → Ausbildung → Sprachen.
- Gemma liefert nur Einträge pro Abschnittstyp; `applyTrackTemplate` erzwingt die Struktur. Gemma kann den Aufbau also nicht verändern, auch nicht im Chat.
- **Die Rolle geht nicht in den Prompt.** Sie ist nur die Kopfzeile (`withRole`). So passt der Inhalt auch nach einem Rollenwechsel noch.
- `suggestTrack` schlägt den Bereich über Stichwörter vor („M&A“ → Finance, „Strategy Consulting“ → Consulting, „Founder's Associate“ → Startup). Ist es nicht eindeutig, wählt der Nutzer selbst.

**Wie „nichts erfinden“ technisch abgesichert ist:**
1. Das LLM schreibt **keine harten Fakten**. Es liefert nur Profil-IDs (`sourceRefs`), Bulletpoints und die Zusammenfassung. Institution, Firma, Rolle, Abschluss, Zeitraum und Ort übernimmt `resolveResume` direkt aus dem Profil.
2. `validateResumeDraft` (als `check` an `generateJson`) lehnt ab: unbekannte IDs, falsche Abschnittstypen, doppelte Einträge und **Zahlen, die nicht in den referenzierten Profil-Einträgen stehen** (in Bulletpoints und in der Zusammenfassung).
3. **Kontaktdaten gehen nie an das LLM** (`profileForPrompt`). Der Kopf des Lebenslaufs kommt direkt aus Profil und Konto.
4. **Nur bestätigte Angaben** (`confirmed: true`) kommen in den Lebenslauf. Unbestätigte Vorschläge (z. B. `"SQL"` mit `confirmed: false`) werden ignoriert. Umschalten: `INCLUDE_UNCONFIRMED` in `src/lib/resume/candidate-profile.ts`.
5. Gemma sieht statt der UUIDs nur kurze Kürzel (`p1`, `p2` …, `aliasProfile`), damit es keine IDs falsch abschreibt. Gespeichert werden die echten IDs.

**Profilformat** (Endformat aus dem Onboarding, `schemaVersion: 1`, Beispiel: `src/lib/resume/fixtures/candidate-profile.example.json`):
- Jeder Wert ist `{ id?, value, source, sourceRef, confirmed, updatedAt }`.
- Genutzt werden `basics.location`, `education[]` (Abschluss-Code, Fach, Semester, voraussichtlicher Abschluss), `experience[]`, `projects[]`, `volunteering[]`, `skills[]` und `languages[]` (Niveau A1–C2/`native`). `goals` gehört zur Stellensuche und wird hier nicht genutzt.
- Stationen (`experience`, `projects`, `volunteering`) haben `start`/`end` (JJJJ-MM; `end: null` mit Start = „heute“) und `details[]`: was die Person dort gemacht hat, ein Punkt pro Eintrag. Nur daraus entstehen die Bulletpoints. Ehrenamt wird intern zur Art `other` und erscheint im Abschnitt „Engagement“. Bei `experience.type` (`internship`, `working_student`, …) übersetzt `resolveResume` den Code in die Sprache des Lebenslaufs.
- Gelesen und auf das interne Format (`resumeProfileSchema` in `src/lib/schemas/resume.ts`) umgesetzt wird es **nur** in `src/lib/resume/candidate-profile.ts`.
- **Name und E-Mail stehen nicht im Profil.** Der Name kommt aus `profiles.display_name` (auf `/profile` eintragbar, gelesen über `getDisplayName`); Vorschau und Export zeigen immer den aktuellen Namen (`withName`), auch in älteren Versionen. Die E-Mail kommt aus dem Konto (`getCurrentUser().email`). Fehlt der Name, zeigt die Vorschau einen Hinweis, und der Export lässt die Zeile weg.
- **Praxiserfahrung, Projekte und Ehrenamt** fragt das Onboarding seit Oktober 2026 direkt nach der Ausbildung ab (`src/lib/onboarding/steps.ts`, Formularlogik in `src/lib/onboarding/stations.ts`). Ältere Profile ohne diese Listen bleiben gültig (Zod-Default `[]`); wer sie nachtragen will, startet das Onboarding auf `/profile` erneut.

**Änderungen im Chat:** Gemma liefert eine komplette neue Fassung. Die Liste der Änderungen berechnet `diffResumes` deterministisch, und `mergeResumes` übernimmt nur die angenommenen. Pro Lebenslauf gibt es höchstens einen offenen Entwurf; „Neu erstellen“ und ein Rollenwechsel verwerfen ihn.

**Lokal testen:**
1. Migration einspielen (siehe 2), dann `npm run db:types`.
2. Das Profil kommt aus dem Onboarding (`candidate_profiles` über `src/lib/profile/server.ts`). Ohne bestätigte Angaben zeigt `/resume` „Dein Profil ist noch leer“ mit Link auf `/profile`. Zum Testen ohne Onboarding `activeSource` in `profile-source.ts` vorübergehend auf `exampleProfileSource` stellen.
3. `npm run dev` → `/resume` → Rolle „Werkstudent M&A“ eingeben (Finance wird vorgeschlagen) → erstellen. Danach eine andere Finance-Rolle eingeben: Sie wird übernommen, ohne dass ein neuer Lebenslauf entsteht. Im Chat „Kürzer, maximal eine Seite“ eingeben, Änderungen teilweise annehmen, PDF/DOCX herunterladen.
4. Tests: `npm run test:resume` (Logik, offline) und `npm run db:test:resume` (RLS, PGlite).

## 2. Neue Migrationen

1. `supabase/migrations/20261101110000_resume_documents.sql`:
   - `resume_documents`: Bereich (`track`), Rolle (`target_role`), Sprache, `active_version`. **Unique `(user_id, track)`**: höchstens ein Lebenslauf pro Bereich.
   - `resume_versions`: alle Versionen als JSON-Snapshot, Status `draft`/`accepted`/`rejected`, höchstens ein Entwurf pro Lebenslauf.
   - Beide Tabellen haben RLS (nur eigene Zeilen) und hängen per `on delete cascade` an `auth.users`.

Tests: `supabase/tests/cv-tailoring.test.mjs`. Der Test ist eigenständig und spielt nur `*_resume_*.sql` ein (gleicher Aufbau wie `jobs.test.mjs`).

## 3. Neue Umgebungsvariablen

Keine. Genutzt wird `GEMINI_API_KEY` bzw. `LLM_MODEL_QUALITY` über `src/lib/llm.ts`.

## 4. Neue npm-Pakete

- `docx`: DOCX-Export.
- `@react-pdf/renderer`: PDF-Export ohne Headless-Chrome. Next führt das Paket standardmäßig als `serverExternalPackages`, deshalb ist keine Konfiguration nötig. **Vor dem Merge von Ole bestätigen lassen.**

## 5. Geänderte Dateien außerhalb der eigenen Zone

Keine. Die Migration hält sich an die Namensregel `202611011xxxxx`. Die Dateinamen beginnen mit `_resume_` statt `_cv-tailoring_`.

## 6. Offene Integrationspunkte

> **Stand nach der Integration ins Repo:** Punkte 1, 2, 4 und 5 sind erledigt. Profilquelle = `onboardingProfileSource` (`getCandidateProfileRecord`), Name aus `profiles.display_name`, `generateJson` liefert `{ data }`, Einwilligung über `useConsentGate` (Status per `hasConsent("resume")` von der Seite, siehe `resume-consent.tsx`), `textarea` per `npx shadcn add` ergänzt. Punkt 3 ist mit Feature C verbunden: `/resume?jobId=…` übernimmt den Stellentitel als Rolle (max. 120 Zeichen) und den Bereich der Stelle.

1. **Profilquelle**: In `src/lib/resume/profile-source.ts` `activeSource` von `exampleProfileSource` auf den echten Speicherort umstellen. `load(userId)` muss das Profil-JSON liefern (oder `null`), `parseCandidateProfile` prüft es. **Sonst muss nichts geändert werden.**
2. **Name im Konto**: Klären, wo der Name des Nutzers liegt. Erwartet wird er in `user_metadata` (`full_name`, `name` oder `display_name`); sonst `accountName` in `profile-source.ts` anpassen.
3. **Job-Übergabe (5.2)**: Die Stellensuche verlinkt auf `/resume?jobId=<id>&track=<bereich>`. `track` liest die Seite schon aus der URL; der passende Lebenslauf ist damit ohne weiteren Code vorausgewählt. Für die Rolle steht in `src/app/(app)/resume/page.tsx` ein `TODO(merge)`: Stellentitel aus `getJobPostingText` als `initialRole`, `job.track` (liefert Feature C jetzt mit) als `initialTrack`. Der Anzeigentext selbst wird nicht gebraucht.
4. **Gemeinsame Dateien prüfen.** Folgende Signaturen sind aus TEAM-KONTEXT übernommen, aber nicht gegen `main` getestet:
   - `generateJson(schema, { tier, system, prompt, check })`, wobei `check` einen Fehlertext oder `null` zurückgibt. Adapter: `draftCheck` in `src/lib/resume/validate.ts`.
   - `hasConsent("resume")` aus `@/lib/consent/server`. Möglicherweise heißt der Pfad auf `main` anders.
   - `ConsentGatedAction`: wird nur in `src/components/resume/resume-consent.tsx` verwendet, Props dort anpassen.
   - `awardXp(user.id, "resume_tailored", XP_REWARDS.resumeTailored, doc.id)`: einmal pro Bereich (beim ersten Erstellen).
5. Den alten Platzhalter `src/app/(app)/resume/page.tsx` auf `main` ersetzt die neue Seite.

## 7. Bekannte Lücken / TODOs

- **Nicht im echten Repo gelaufen:** `npm run build`, `npm run lint` und der Durchlauf im Browser fehlen noch. Entwickelt wurde in einem separaten Ordner mit Stubs für die gemeinsamen Dateien. Typprüfung (`tsc`), Unit-Tests, RLS-Tests und der Export (PDF/DOCX für alle drei Bereiche gerendert und geprüft) sind grün.
- **Prompts nicht mit Gemma getestet** (kein Key vorhanden). Wenn Gemma oft an `check` scheitert, sind zuerst die Prompts in `src/lib/prompts/resume-*.ts` anzupassen.
- Die Bereichserkennung arbeitet nur mit Stichwörtern. Erkennt sie nichts, muss der Nutzer den Bereich selbst wählen.
- Die Zahlenprüfung erkennt nur Ziffern. Ausgeschriebene Zahlen („zwanzig“) und erfundene Inhalte ohne Zahlen werden nur durch den Prompt verhindert.
- Ein Layout für alle drei Bereiche (einspaltig, ohne Foto); sie unterscheiden sich in Aufbau und Inhalt, nicht in der Optik. Ein Layout-Wunsch von Ole steht noch aus.
- Pro Bereich gibt es eine Sprache. Ein Sprachwechsel erstellt den Lebenslauf neu (ältere Versionen bleiben abrufbar).
- Kein eigenes Rate-Limit für Generierung und Chat. Bei Bedarf das Muster aus `src/lib/jobs/rate-limit.ts` übernehmen.
