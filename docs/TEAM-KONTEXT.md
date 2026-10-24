# TEAM-KONTEXT – Parallele Feature-Entwicklung

> **An Claude (oder wer auch immer das liest):** Diese Datei ergänzt `CLAUDE.md`. Lies **zuerst `CLAUDE.md` vollständig**, dann diese Datei. Wo sich beide widersprechen, gilt **diese Datei**. Arbeite nur an **deinem** Feature (siehe Abschnitt 4), halte dich an die Dateigrenzen (Abschnitt 3) und an die Schnittstellen (Abschnitt 5). Ziel ist, dass drei Branches am Ende ohne Umbau zusammengeführt werden können.

Stand dieser Datei: 2026-10-24, Basis-Commit = der Commit, in dem diese Datei hinzugefügt wurde.

---

## 1. Was es schon gibt (Stand `main`)

Fertig sind Schritt 1–4 aus `CLAUDE.md`:

- **Grundgerüst:** Next.js 16 (App Router, TS strikt), Tailwind 4, shadcn/ui (Basis: `@base-ui/react`), Tab-Navigation (`src/components/app-nav.tsx`), Supabase-Login per Magic Link, geschützte Routen über `src/proxy.ts` (in Next 16 heißt Middleware „Proxy").
- **Datenbank:** alle Tabellen aus `CLAUDE.md` Abschnitt 5 mit RLS (`supabase/migrations/`), generierte Typen in `src/lib/supabase/database.types.ts`, RLS-Tests mit `npm run db:test` (PGlite, kein Supabase-Projekt nötig).
- **Einwilligung:** `consents`-Tabelle, Dialog + Hooks (`src/components/consent/`, `src/lib/consent/`). Typen `voice` und `resume` existieren bereits.
- **Interview (Consulting) + Feedback:** Feedback per Gemma 4 über `src/lib/llm.ts`, XP-Vergabe über `src/lib/gamification/xp.ts`.

**Wichtige Abweichung von `CLAUDE.md`:** Das Interview nutzt **keinen** ElevenLabs-Agenten mehr, sondern ein One-Way-Format: Fragen werden per ElevenLabs Text-to-Speech vorgelesen, Antworten aufgenommen und per ElevenLabs Speech-to-Text transkribiert (`src/lib/elevenlabs.ts`: `synthesizeSpeech`, `transcribeAudio`). Es gibt keine `ELEVENLABS_AGENT_ID_*`-Variablen. Die Signed-URL-Route existiert nicht.

**Next.js 16 ist neuer als dein Trainingswissen.** Lies vor dem Schreiben von Next-Code die passende Doku in `node_modules/next/dist/docs/` (siehe `AGENTS.md`). Beispiele: `RouteContext<"/api/...">` für Route-Params, `after()` für Hintergrundarbeit, `proxy.ts` statt `middleware.ts`.

---

## 2. Arbeitsweise im Team

### Branches

| Feature | Branch | Verantwortlich |
|---|---|---|
| A – Lebenslauf zuschneiden | `feature/cv-tailoring` | Freund/in 1 |
| B – Gamification / Charakter | `feature/gamification` | Freund/in 2 |
| C – Stellen-Scraper | `feature/job-scraper` | Freund/in 3 |

- Jede/r branched von `main` beim Basis-Commit und arbeitet **nur** auf dem eigenen Branch.
- Kleine, thematische Commits mit englischen Commit-Messages. Kein Force-Push auf `main`.
- Regelmäßig `main` in den eigenen Branch mergen, falls `main` sich ändert.
- Wenn du eine Datei außerhalb deiner Zone (Abschnitt 3) ändern musst: **erst mit Ole absprechen**, dann die Änderung so klein wie möglich halten und in der Übergabe-Notiz (Abschnitt 7) aufführen.

### Lokale Umgebung (jede/r für sich)

1. Repo klonen, `npm install`, `cp .env.example .env.local`.
2. **Eigenes** Supabase-Projekt anlegen (Region Frankfurt), alle Migrationen aus `supabase/migrations/` in Dateinamen-Reihenfolge im SQL-Editor ausführen (Anleitung im README). So kollidieren eure Test-Migrationen nicht.
3. Eigene API-Keys besorgen (nie teilen, nie committen):
   - Alle: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - A und C (falls LLM genutzt): `GEMINI_API_KEY`, `LLM_MODEL_LIVE`, `LLM_MODEL_QUALITY` (Google AI Studio)
   - A: `ELEVENLABS_API_KEY` (für Speech-to-Text der Erfahrungen)
4. `npm run dev` → <http://localhost:3000>.

### Definition of Done (zusätzlich zu `CLAUDE.md` Abschnitt 9)

- `npm run build`, `npm run lint`, `npm run db:test` sind grün.
- Neue Tabellen haben RLS-Policies **und** Tests in `supabase/tests/`.
- Übergabe-Notiz `docs/handoff/<feature>.md` ist geschrieben (Abschnitt 7).

---

## 3. Dateizonen (gegen Merge-Konflikte)

### Gemeinsame Dateien – nur lesen/benutzen, nicht ändern

| Datei | Wofür |
|---|---|
| `src/lib/llm.ts` | `generateText(...)`, `generateJson(schema, ...)` – **einziger** Weg zu Gemma |
| `src/lib/elevenlabs.ts` | `transcribeAudio(blob, filename)`, `synthesizeSpeech(text)` |
| `src/lib/api.ts` | `apiError(status, deutscheMeldung)`, `apiOk(body)`, `readJson(request)` |
| `src/lib/supabase/server.ts` | `createClient()` (RLS, als Nutzer), `getCurrentUser()` |
| `src/lib/supabase/admin.ts` | `createAdminClient()` (Service Role, umgeht RLS – nur für Server-Schreibzugriffe wie XP) |
| `src/lib/consent/*`, `src/components/consent/*` | Einwilligungen prüfen (`hasConsent`) und Dialog anzeigen (`ConsentGatedAction`, `useConsentGate`) |
| `src/components/ui/*` | shadcn-Komponenten. **Neue** per `npx shadcn add <name>` hinzufügen ist erlaubt, bestehende nicht umbauen |
| `src/lib/interview/*`, `src/components/interview/*`, `src/app/(app)/interviews/*`, `src/app/api/interviews/*` | Interview-Feature (Ole) |
| `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/proxy.ts` | Rahmen der App |
| bestehende Migrationen | **Nie** eine existierende Migration ändern – nur neue Dateien anlegen |

### Dateien, die beim Merge sowieso neu entstehen

- `src/lib/supabase/database.types.ts`: Du darfst sie in deinem Branch neu generieren (`npm run db:types`). Beim Merge wird sie **einmal neu generiert**, Konflikte darin werden nicht von Hand gelöst.
- `package.json` / `package-lock.json`: Neue Pakete sind ok (in der Übergabe-Notiz nennen). Konflikte werden mit `npm install` gelöst.
- `README.md`: Nur einen eigenen Abschnitt anhängen (z. B. `## Lebenslauf zuschneiden`) und die eigene Checkbox im „Stand" abhaken. Nichts anderes umschreiben.
- `.env.example`: Nur neue Zeilen **am Ende** ergänzen, mit Kommentar, zu welchem Feature sie gehören.

### Eigene Zonen

| Feature | Darf frei anlegen/ändern |
|---|---|
| A – CV | `src/app/(app)/resume/**`, `src/app/api/resume/**`, `src/app/api/experience/**`, `src/lib/resume/**`, `src/lib/experience/**`, `src/lib/prompts/resume-*.ts`, `src/lib/prompts/experience-*.ts`, `src/lib/schemas/resume.ts`, `src/lib/schemas/experience.ts`, `src/components/resume/**` |
| B – Gamification | `src/app/(app)/character/**`, `src/lib/gamification/**` (inkl. `xp.ts`, siehe 5.1), `src/components/character/**`, `public/avatar/**` |
| C – Scraper | `src/app/(app)/jobs/**`, `src/app/api/jobs/**`, `src/lib/jobs/**`, `src/lib/prompts/job-*.ts`, `src/lib/schemas/job-posting.ts`, `src/components/jobs/**` |

### Migrationen

- Dateiname: `supabase/migrations/<YYYYMMDDHHMMSS>_<feature>_<was>.sql`, z. B. `20261101120000_jobs_job_postings.sql`.
- Damit sich Zeitstempel nicht überschneiden, nutzt jedes Feature einen eigenen Bereich:
  A: `202611011xxxxx`, B: `202611012xxxxx`, C: `202611013xxxxx` (gleiches Datum, unterschiedliche Stunde – Reihenfolge ist dann egal, weil die Features unabhängig sind).
- Neue Enum-Werte nur per `alter type public.<enum> add value if not exists '<wert>';` in einer eigenen Migration.
- Jede neue Tabelle mit Nutzerdaten: `user_id uuid not null default auth.uid() references auth.users (id) on delete cascade`, RLS an, Policies im Stil der bestehenden (`(select auth.uid())`), `revoke all ... from anon, authenticated` und dann nur nötige `grant`s.
- Tests: Eigene Checks in **eigener Datei** `supabase/tests/<feature>.test.mjs` (den Aufbau aus `rls.test.mjs` kopieren) und in `package.json` **nicht** `db:test` ändern, sondern beim Merge zusammenführen lassen. Alternativ: am Ende von `rls.test.mjs` einen klar markierten Block `// --- <feature> ---` anhängen.

---

## 4. Die drei Features

### Feature A – Lebenslauf zuschneiden (`feature/cv-tailoring`)

Entspricht **Schritt 6** in `CLAUDE.md`. Arbeite in diesen Teilschritten, jeweils mit Commit:

1. **Upload + Textextraktion:** `POST /api/resume/parse`. Nur PDF/DOCX, max. 5 MB (Größe **und** Typ serverseitig prüfen, auch die Magic Bytes, nicht nur die Endung). PDF lesen mit `unpdf` oder `pdfjs-dist`, DOCX mit `mammoth`. Die Datei selbst wird **nicht** gespeichert, nur der Text (`resumes.original_text`). Einwilligung `resume` vorher prüfen (`hasConsent("resume")` serverseitig, `ConsentGatedAction` im UI – die Seite `resume/page.tsx` nutzt das schon als Platzhalter).
2. **Strukturiertes Parsing:** Gemma (`tier: "quality"`) via `generateJson(resumeSchema, ...)` → `resumes.parsed`. Schema in `src/lib/schemas/resume.ts`, Prompt in `src/lib/prompts/resume-parse.ts`.
3. **Erfahrungen einsprechen:** Aufnahme im Browser (MediaRecorder, siehe Muster in `src/components/interview/use-interview-audio.ts`, nicht importieren, sondern eigene Kopie in `src/components/resume/`), `POST /api/experience/transcribe` → `transcribeAudio` → `generateJson(experienceSchema, { tier: "live", ... })` → `experiences`. Einwilligung `voice`. Audio nie speichern.
4. **Stellenanzeige einfügen:** Textfeld. Link-Import optional (dann serverseitig abrufen, nur Text extrahieren). Siehe Schnittstelle 5.2 für die Übergabe aus dem Scraper.
5. **Tailoring:** `POST /api/resume/tailor`, Gemma `quality`, Prompt `src/lib/prompts/resume-tailor.ts`. **Nichts erfinden**: Das Ergebnis ist eine Liste von Änderungsvorschlägen, jeder mit Bezug auf die Quelle (CV-Abschnitt oder Erfahrungs-ID). Fehlende Angaben werden als `questions` an den Nutzer zurückgegeben. Mit `check` in `generateJson` prüfen, dass referenzierte Quellen existieren. Ergebnis in `tailored_resumes.result`.
6. **Vorher/Nachher-Ansicht:** Pro Änderung „Annehmen" / „Ablehnen". Erst danach Export.
7. **Export:** `POST /api/resume/export` → DOCX mit `docx`, PDF aus denselben strukturierten Daten (z. B. `@react-pdf/renderer` oder `pdf-lib`; **kein** Headless-Chrome, das läuft auf Vercel schlecht). Vorher mit Ole abstimmen, welche Lib.

XP: siehe Schnittstelle 5.1 – nach erfolgreichem Upload, Erfahrung und Tailoring je ein `awardXp`.

Offene Fragen an Ole (vor Beginn klären): Layout/Template des exportierten CVs; ein oder mehrere gespeicherte Lebensläufe pro Nutzer.

### Feature B – Gamification / Charakter (`feature/gamification`)

Entspricht **Schritt 7** in `CLAUDE.md`.

1. **XP und Level berechnen** – ausschließlich aus `xp_events` (Summe von `amount`). Reine Funktionen in `src/lib/gamification/levels.ts` (Levelkurve, z. B. `xpForLevel(n)`, `levelFromXp(xp)`) mit Titeln („Bewerber-Rookie" → … → „Interview-Profi"). Kurve und Titel als konfigurierbare Konstanten.
2. **Badges** – `src/lib/gamification/badges.ts`: Liste von Badge-Definitionen (`id`, Titel, Beschreibung, Bedingung als Funktion über die Events/Statistiken). Badges werden **abgeleitet**, nicht gespeichert.
3. **Streaks** – `src/lib/gamification/streak.ts`: Aus den Tagen (Zeitzone Europe/Berlin) mit mindestens einem XP-Event. Wenn ein `daily_streak`-XP-Event vergeben werden soll: Achtung, der bestehende Unique-Index greift nur bei `ref_id is not null`. Lösung per eigener Migration (z. B. Unique-Index auf `(user_id, (created_at at time zone 'Europe/Berlin')::date) where type = 'daily_streak'`) oder Streak nur anzeigen, ohne XP. Entscheidung kurz mit Ole abstimmen.
4. **Avatar** – SVG mit Layern in `src/components/character/`, Optik ändert sich mit dem Level (Kleidung, Accessoires, Hintergrund). Keine externen Bilder ohne Lizenz.
5. **Level-up-Animation** – Zuletzt gesehenes Level merken (eigene Spalte in `profiles` per Migration oder `localStorage`), bei Anstieg Animation zeigen. `prefers-reduced-motion` respektieren.
6. **Charakter-Seite** `src/app/(app)/character/page.tsx` ersetzt den Platzhalter: Avatar, Level, XP-Balken bis zum nächsten Level, Badges, Streak, letzte XP-Events (Typ + Betrag, deutsch beschriftet).

Lesen der Events: als Nutzer über `createClient()` (RLS erlaubt `select` auf eigene `xp_events`). Schreiben **nur** über `awardXp` (Service Role). Testdaten: im eigenen Supabase-Projekt per SQL-Editor `xp_events` einfügen – die anderen Features gibt es auf deinem Branch noch nicht.

Nicht in deinem Scope: XP-Toast nach dem Interview oder Level-Anzeige im Header. Wenn gewünscht, als fertige Komponente (z. B. `src/components/character/level-badge.tsx`) bauen und in der Übergabe-Notiz beschreiben, wo sie eingebaut werden soll – Ole baut sie beim Merge ein.

### Feature C – Stellen-Scraper (`feature/job-scraper`)

Neues Feature, steht noch nicht in `CLAUDE.md`. Ziel: Nutzer findet passende Stellen (Praktika, Werkstudent, Einstieg) und kann mit einem Klick den Lebenslauf darauf zuschneiden.

**Rechtliches zuerst (verbindlich):**
- **Kein** Scraping von LinkedIn, Indeed, StepStone, XING o. Ä. – deren Nutzungsbedingungen verbieten es.
  > **Entschieden von David am 2026-10-24 (final):** Für LinkedIn, Indeed und StepStone gilt das nicht mehr. Die Adapter von Feature C sind erlaubt und standardmäßig aktiv (`JOBS_ENABLE_SCRAPED_SOURCES=false` schaltet sie ab). Bot-Schutz wird weiterhin nicht umgangen. Details: `docs/handoff/job-scraper.md`.
- Bevorzugt offizielle/offene Quellen:
  - **Bundesagentur für Arbeit – Jobsuche-API** (öffentlich, kostenlos, große Abdeckung in DE).
  - **Arbeitnow Job Board API** (frei, ohne Key).
  - **Adzuna API** (kostenloser Key).
  - **Öffentliche Karriereseiten-APIs** von ATS-Systemen (Greenhouse, Lever, Personio – öffentliche JSON-Feeds pro Firma), gut für Startups.
- Wenn doch HTML gelesen wird: `robots.txt` respektieren, eigener User-Agent, Rate-Limit, Caching. Erst mit Ole absprechen.
- Prüfe die aktuellen Bedingungen jeder Quelle selbst, bevor du sie einbaust, und dokumentiere sie in der Übergabe-Notiz.

**Aufbau:**
1. **Quellen-Adapter** in `src/lib/jobs/sources/<quelle>.ts`, jeder liefert `JobPosting[]` im gemeinsamen Format (Schnittstelle 5.2). Neue Quelle = neue Datei, kein Umbau.
2. **Suche** `GET /api/jobs/search?q=&location=&track=` – serverseitig, Eingaben mit Zod validieren, Ergebnisse kurz cachen (Tabelle `job_postings` ohne `user_id`, nur öffentliche Stellendaten, oder Next-Cache). Rate-Limit pro Nutzer.
3. **Merken** – Tabelle `saved_jobs` (pro Nutzer, RLS) mit Verweis auf die Stelle.
4. **Seite** `src/app/(app)/jobs/page.tsx` „Stellen": Suchfeld, Filter (Track Startup/Consulting/Finance, Ort, Einstieg/Praktikum), Ergebnisliste, Detailansicht mit Beschreibung, Link zur Originalanzeige, Button **„Lebenslauf für diese Stelle anpassen"** (Schnittstelle 5.2).
5. Optional: Track-Zuordnung oder Zusammenfassung per Gemma (`tier: "live"`, Prompt in `src/lib/prompts/job-*.ts`). Nur über `llm.ts`.
6. Kein Cron-Job im ersten Schritt, Suche on demand.

**Navigation:** Du darfst in `src/components/app-nav.tsx` **genau** einen Eintrag `{ href: "/jobs", label: "Stellen", icon: BriefcaseIcon }` in `TABS` ergänzen (nach „Lebenslauf") und in `MobileNavList` `grid-cols-3` → `grid-cols-4` ändern. Sonst nichts in dieser Datei.

Offene Fragen an Ole (vor Beginn klären): welche Quellen zuerst; eigener Tab oder Bereich im Lebenslauf-Tab (Default oben: eigener Tab).

---

## 5. Schnittstellen zwischen den Features

### 5.1 XP-Vergabe (A → B, später auch C)

- Event-Typen (Enum `xp_event_type`, existiert schon): `interview_finished`, `feedback_score`, `resume_uploaded`, `resume_tailored`, `experience_recorded`, `daily_streak`.
- Beträge stehen in `XP_REWARDS` in `src/lib/gamification/xp.ts` (auf `main` bereits angelegt: `resumeUploaded`, `experienceRecorded`, `resumeTailored`).
- **Feature A** ruft nach dem erfolgreichen Speichern serverseitig auf:
  ```ts
  await awardXp(user.id, "resume_uploaded", XP_REWARDS.resumeUploaded, resume.id);
  await awardXp(user.id, "experience_recorded", XP_REWARDS.experienceRecorded, experience.id);
  await awardXp(user.id, "resume_tailored", XP_REWARDS.resumeTailored, tailored.id);
  ```
  `refId` ist immer die ID der gerade gespeicherten Zeile (macht es idempotent).
- **Feature B** darf `xp.ts` umbauen und Beträge ändern, aber **die Signatur von `awardXp` und die Schlüssel in `XP_REWARDS` bleiben gleich**. Neue Schlüssel hinzufügen ist ok.
- **Feature C** vergibt vorerst kein XP. Falls gewünscht (z. B. „Stelle gemerkt"), neuen Enum-Wert per eigener Migration und Absprache.

### 5.2 Stellenanzeige (C → A)

Gemeinsames Format, definiert von **C** in `src/lib/schemas/job-posting.ts`:

```ts
export const jobPostingSchema = z.object({
  id: z.uuid(),                 // interne ID (job_postings.id)
  source: z.string(),           // z. B. "arbeitsagentur", "arbeitnow"
  sourceUrl: z.url(),           // Link zur Originalanzeige
  title: z.string(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  track: z.enum(["startup", "consulting", "finance"]).nullable(),
  description: z.string(),      // reiner Text, kein HTML
  publishedAt: z.string().nullable(), // ISO-Datum
});
export type JobPosting = z.infer<typeof jobPostingSchema>;
```

Übergabe an den Lebenslauf:
- **C** verlinkt mit `"/resume?jobId=<id>"`.
- **C** stellt bereit: `src/lib/jobs/handoff.ts` mit
  `export async function getJobPostingText(id: string): Promise<{ title: string; company: string | null; sourceUrl: string; text: string } | null>`
  (`text` = Titel, Firma und Beschreibung als ein zusammenhängender Text für das Tailoring).
- **A** baut die Stellenanzeige-Eingabe so, dass sie einen **vorbefüllten Text** annehmen kann (Prop `initialJobPostingText?: string`) und speichert in `tailored_resumes.job_posting_text` immer den Text, nicht nur die ID. A importiert `handoff.ts` **nicht** (gibt es auf dem Branch nicht) – die Verbindung `jobId` → `getJobPostingText` → `initialJobPostingText` baut Ole beim Merge (wenige Zeilen in `resume/page.tsx`).

### 5.3 Datenlöschung

Jede neue Tabelle mit Nutzerbezug hängt per `on delete cascade` an `auth.users`. Damit greift die spätere Funktion „Meine Daten löschen" automatisch. Öffentliche Cache-Tabellen (z. B. `job_postings`) enthalten keine personenbezogenen Daten.

---

## 6. Verbindliche Regeln (Kurzfassung, Details in `CLAUDE.md`)

- Sichtbare Texte **Deutsch**, Code/Kommentare **Englisch**. Du-Form wie im Rest der App.
- TypeScript strikt, kein `any`. Zod für alle API-Eingaben und LLM-Ausgaben.
- API-Routen nach dem Muster von `src/app/api/interviews/[id]/finish/route.ts`: `getCurrentUser()` → 401, Params/Body mit Zod → 400, deutsche Fehlermeldungen über `apiError`.
- Gemma **nur** über `src/lib/llm.ts`, Prompts in eigenen Dateien unter `src/lib/prompts/`. Keine Prompts oder Modellausgaben loggen (personenbezogene Daten).
- Keine Secrets im Code. Keys nur serverseitig (`import "server-only"` in Server-Modulen).
- Lade-, Fehler- und Leerzustände immer in der UI behandeln. Mobile-first.
- Bei größeren Annahmen (Design, Datenschutz, neue Dienste/Libs): erst Ole fragen.

---

## 7. Übergabe-Notiz (Pflicht vor dem Merge)

Lege `docs/handoff/<feature>.md` an (`cv-tailoring`, `gamification`, `job-scraper`) mit:

1. Was gebaut wurde (3–5 Sätze) und wie man es lokal testet.
2. Neue Migrationen (Dateinamen, in welcher Reihenfolge einspielen).
3. Neue Umgebungsvariablen.
4. Neue npm-Pakete und warum.
5. Geänderte Dateien **außerhalb** der eigenen Zone (mit Grund).
6. Offene Integrationspunkte (z. B. „Komponente X soll im Header eingebaut werden").
7. Bekannte Lücken / TODOs.

---

## 8. Merge-Plan (macht Ole)

Reihenfolge: **B → A → C** (B ist am unabhängigsten, A liefert XP-Events, C hängt sich an A an).

Nach jedem Merge:
1. Konflikte in `package-lock.json` → `npm install`; in `database.types.ts` → neu generieren.
2. Neue Migrationen im gemeinsamen Supabase-Projekt einspielen.
3. `npm run db:test && npm run lint && npm run build`.
4. Integrationspunkte aus der Übergabe-Notiz einbauen (z. B. 5.2 `jobId`-Übergabe).
5. Kurzer manueller Durchlauf im Browser, dann Commit.
