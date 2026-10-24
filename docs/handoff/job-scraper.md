# Übergabe: Feature C – Stellen-Scraper (`feature/job-scraper`)

## ⚠️ Zuerst lesen: LinkedIn, Indeed und StepStone (TEAM-KONTEXT 4C)

TEAM-KONTEXT 4C hat das Scraping von LinkedIn, Indeed und StepStone ursprünglich verboten. **Entschieden von David am 2026-10-24:** Die drei Adapter sind erlaubt, bleiben im Repo und sind standardmäßig aktiv. Das ist final.

- `JOBS_ENABLE_SCRAPED_SOURCES=false` schaltet die drei Adapter ab; ohne die Variable oder mit `true` laufen sie mit.
- Die Adapter umgehen keinen Bot-Schutz: kein Captcha-Lösen, keine Stealth-Tricks, keine Proxys, keine gefälschten Browser- oder App-Kennungen. Sie senden einen eigenen, ehrlichen User-Agent. Zeigt ein Portal eine Prüfseite oder antwortet mit 403/429, meldet der Adapter „blockiert“ und die anderen Quellen liefern weiter.
- **Indeed-Beispielstellen (entschieden von David am 2026-10-24):** Ist Indeed blockiert oder nicht erreichbar, liefert der Adapter 5 erfundene Stellen passend zur Suche (`src/lib/jobs/sources/indeed-mock.ts`). Sie haben die Quelle `indeed-demo`, Platzhalterfirmen („Muster …“), das Badge „Indeed · Beispiel“, einen Hinweis in der Detailansicht und verlinken auf die echte Indeed-Suche („Auf Indeed suchen“). Die Quellenzeile zeigt „Indeed (Beispieldaten)“. `JOBS_INDEED_MOCK=false` schaltet das ab, dann erscheint Indeed wieder als „blockiert“.
- Entfernen ginge weiterhin ohne Umbau: die drei Dateien `src/lib/jobs/sources/{linkedin,indeed,stepstone}.ts` löschen und die Einträge in `sources/index.ts` streichen.

## 1. Was gebaut wurde

Neuer Tab **„Stellen“** (`/jobs`):
- Suche nach Begriff und Ort, Filter nach Bereich (Startup/Consulting/Finance) und Art (Praktikum/Werkstudent/Einstieg).
- Alle aktiven Quellen werden parallel abgefragt, jede mit 10 s Zeitlimit. Ergebnisse werden vereinheitlicht, Dubletten über Portale hinweg entfernt, und das Ganze wird 6 h zwischengespeichert.
- Die Detailansicht lädt die volle Beschreibung bei Bedarf nach. Sie hat einen Link zur Originalanzeige und den Button **„Lebenslauf für diese Stelle anpassen“** (`/resume?jobId=<id>&track=<bereich>`; `track` nur, wenn der Bereich erkannt wurde).
- Stellen lassen sich merken; die gemerkten Stellen stehen in einer eigenen Liste.
- Bereich und Art werden über Stichwörter erkannt, ohne LLM.
- **Profil** (finales Onboarding-Format, `schemaVersion: 1`): Die Seite liest daraus nur **bestätigte** Werte, also Wunschorte und Wohnort, Bereiche, Arten, Remote, frühesten Start und Skills (`src/lib/jobs/profile.ts`).
  - Die Suche ist mit dem jeweils ersten Ort, Bereich und Art vorbelegt und startet beim Öffnen automatisch; die anderen Profilwerte stehen als Schnellauswahl darunter.
  - Treffer werden nach Passung sortiert (`src/lib/jobs/fit.ts`), mit Begründung auf der Karte („Passt zu dir: Consulting · Praktikum · Frankfurt am Main · Excel“). Liegt ein ausdrücklicher Starttermin vor dem frühesten Start, erscheint eine Warnung; „ab sofort“ zählt nicht als zu früh.
  - In der Detailansicht steht der persönliche Bewerbungszeitraum, z. B. „Für deinen Start ab 03/2027: ca. 03/2026–09/2026 bewerben (eher spät – bewirb dich zeitnah)“.
  - Die Profildaten bleiben im Browser des Nutzers und auf dem Server, sie gehen **nicht** an Gemma.
- **Zusatzinfos** aus den Portalen (`insights`): Starttermin (BA), Gehaltsspanne (StepStone, Adzuna), Ablaufdatum der Anzeige (StepStone), „Anschreiben nicht nötig“ und „Schnellbewerbung“ (StepStone), Bewerberzahl (LinkedIn).
- **Einschätzung** (`GET /api/jobs/[id]/outlook`): wie lange vor dem Start man sich bewirbt, typischer Bewerbungszeitraum, Andrang und ein Tipp. Echte Portaldaten haben Vorrang: der Vorlauf aus Veröffentlichung und Starttermin (BA) und der Andrang aus der Bewerberzahl (LinkedIn). **Alles andere schätzt Gemma** (`tier: "live"`, Prompt `src/lib/prompts/job-outlook.ts`) pro Firma und Art der Stelle, 30 Tage zwischengespeichert in `job_outlook_cache`. Auf Wunsch des Feature-Verantwortlichen zeigt die Oberfläche **nicht an, welcher Wert von Gemma und welcher aus einem Portal stammt**. Alle Werte erscheinen als Näherung („ca. 6–12 Monate vor Start“, „Andrang: hoch“). Der Prompt enthält nur öffentliche Stellendaten, nichts über den Nutzer.

**Lokal testen:**
1. Migrationen einspielen (siehe Abschnitt 2), dann `npm run db:types`.
2. `npm run dev`, einloggen, `/jobs` öffnen. Die Suche startet mit den bestätigten Werten aus dem Onboarding-Profil (mit den Angaben aus `docs/candidate-profile.example.json`: „Frankfurt am Main“ / „Consulting“ / „Praktikum“); danach z. B. selbst „Strategy“ / „München“ suchen. Ohne Profil startet die Suche leer.
3. LinkedIn, Indeed und StepStone sind standardmäßig dabei. Abschalten: `JOBS_ENABLE_SCRAPED_SOURCES=false` in `.env.local`, dann den Dev-Server neu starten.
4. Tests: `npm run test:jobs` (Adapter und Logik, offline) und `npm run db:test:jobs` (RLS, PGlite).

**Quellen und ihre Bedingungen** (geprüft am 24.10.2026):

| Quelle | Art | Bedingungen / Status |
|---|---|---|
| Bundesagentur für Arbeit | offizielle API | Öffentliche Jobsuche-API (jobsuche.api.bund.dev). Suche über `pc/v6/jobs`, Details über `pc/v4/jobdetails/<base64(refnr)>`, Header `X-API-Key: jobboerse-jobsuche`. v4-Suche und v6-Details antworten mit 403. |
| Arbeitnow | offizielle API | Frei und ohne Key. Bedingungen laut API-Antwort: „please do not abuse“, Backlink erwünscht, AGB von arbeitnow.com. Keine Suchparameter, daher werden 2 Seiten (je 300 Stellen) geladen und lokal gefiltert. |
| Adzuna | offizielle API | Kostenloser Key nötig, nur aktiv, wenn `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` gesetzt sind. **Nicht live getestet** (kein Key vorhanden). |
| StepStone | Scraping (Schalter) | Daten aus `window.__PRELOADED_STATE__` der Suchseite, Beschreibung aus dem JSON-LD der Detailseite. Live getestet: funktioniert. |
| LinkedIn | Scraping (Schalter) | Öffentliche Gast-Jobsuche, auf Deutschland begrenzt (`geoId`). Live getestet: meist 10 Treffer inklusive Beschreibung und Bewerberzahl, gelegentlich JavaScript-Prüfung oder 429 (wird als „blockiert“ gemeldet). Unzuverlässig. |
| Indeed | Scraping (Schalter) | Antwortet fast immer mit 403 bzw. „Security Check“; der RSS-Feed ist abgeschaltet (404), eine offene Such-API gibt es nicht. Dann liefert der Adapter **Beispielstellen** (siehe unten). Der Parser ist nur gegen synthetisches Markup getestet. |

## 2. Neue Migrationen (in dieser Reihenfolge)

1. `supabase/migrations/20261101130000_jobs_job_postings.sql`: `job_postings`. Öffentliche Stellendaten **ohne** `user_id`; `select` für authenticated, schreiben nur mit dem Service-Role-Key.
2. `supabase/migrations/20261101130100_jobs_saved_jobs.sql`: `saved_jobs` (pro Nutzer, RLS, `on delete cascade`).
3. `supabase/migrations/20261101130200_jobs_search_cache.sql`: `job_search_cache` (nur Service-Role-Key) und `job_search_events` (Rate-Limit, pro Nutzer, RLS, `on delete cascade`).
4. `supabase/migrations/20261101130300_jobs_insights_outlook.sql`: neue Spalten in `job_postings`. Die Suche schreibt `snippet` und `insights`, die Detailseite schreibt `description`, `detail_insights` und `details_fetched_at`, damit eine neue Suche die Detaildaten nicht überschreibt. Dazu die Tabelle `job_outlook_cache` (nur Service-Role-Key).

Tests: `supabase/tests/jobs.test.mjs`. Der Test ist eigenständig: Er legt Rollen, `auth.users` und `auth.uid()` in PGlite an und spielt nur die `*_jobs_*.sql`-Migrationen ein. Geprüft wird:
- anon kann nichts lesen;
- authenticated kann nicht in `job_postings` schreiben;
- Nutzer sehen, speichern und löschen nur ihre eigenen gemerkten Stellen;
- beim Löschen eines Nutzers wird alles mitgelöscht;
- `job_search_cache` und `job_outlook_cache` sind für Nutzer gesperrt;
- die neuen Spalten aus Migration 4 haben leere Standardwerte.

## 3. Neue Umgebungsvariablen

Am Ende von `.env.example` anhängen:

```bash
# --- Feature C – Stellen-Scraper ---
# LinkedIn/Indeed/StepStone-Adapter (siehe docs/handoff/job-scraper.md). Standard: an, false schaltet sie ab.
JOBS_ENABLE_SCRAPED_SOURCES=true
# Indeed blockiert fast immer; dann zeigt der Tab Beispielstellen (als „Beispiel“ markiert). false: Indeed als „blockiert“ melden.
JOBS_INDEED_MOCK=true
# Optional: Adzuna API (https://developer.adzuna.com), kostenloser Key
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
```

Für die Einschätzung braucht Feature C außerdem die **bestehenden** LLM-Variablen `GEMINI_API_KEY` und `LLM_MODEL_LIVE` (siehe TEAM-KONTEXT 2). Sind sie nicht gesetzt, zeigt die Einschätzung nur die Portaldaten.

## 4. Neue npm-Pakete

Kurzfassung zum Installieren: `docs/handoff/job-scraper-requirements.txt`.

```bash
npm install cheerio@^1.2.0 server-only@^0.0.1   # HTML-Parsing (LinkedIn, Indeed); "server-only" für Server-Module, falls noch nicht vorhanden
npm install -D tsx@^4.23.15                     # TypeScript-Unit-Tests mit node:test (Pfad-Alias @/ wird aufgelöst)
```

Neue Scripts in `package.json`. `db:test` bleibt unverändert und wird beim Merge zusammengeführt:

```json
"test:jobs": "node --conditions=react-server --import tsx --test \"src/lib/jobs/__tests__/*.test.ts\"",
"db:test:jobs": "node --test supabase/tests/jobs.test.mjs"
```

`--conditions=react-server` ist nötig, damit `import "server-only"` in Tests nicht wirft. `@electric-sql/pglite` und `zod` sind schon im Projekt vorhanden.

## 5. Geänderte Dateien außerhalb der eigenen Zone

- `src/components/app-nav.tsx`: wie in TEAM-KONTEXT 4C erlaubt. Ein Eintrag in `TABS` nach „Lebenslauf“:
  ```ts
  import { BriefcaseIcon } from "lucide-react";
  // …
  { href: "/jobs", label: "Stellen", icon: BriefcaseIcon },
  ```
  Dazu in `MobileNavList` `grid-cols-3` → `grid-cols-4`. Sonst nichts.
- `.env.example`, `package.json`, `README.md`: nur angehängt (siehe oben bzw. unten).

README-Abschnitt zum Anhängen:

```md
## Stellen-Scraper

Tab „Stellen“ (`/jobs`): sucht Praktika, Werkstudentenjobs und Einstiegsstellen bei der Bundesagentur für Arbeit
und Arbeitnow (optional Adzuna), dazu LinkedIn, Indeed und StepStone (abschaltbar mit `JOBS_ENABLE_SCRAPED_SOURCES=false`).
Tests: `npm run test:jobs`, `npm run db:test:jobs`. Details: `docs/handoff/job-scraper.md`.
```

## 6. Offene Integrationspunkte

> **Stand nach der Integration ins Repo:** Profilquelle = `onboardingProfileSource` (`getCandidateProfileRecord`, dieselbe Quelle wie Feature A). `generateJson` liefert `{ data }`; `createClient()`/`createAdminClient()` können `null` liefern und laufen deshalb über `src/lib/jobs/db.ts`. `badge` per `npx shadcn add` ergänzt. Die Übergabe an den Lebenslauf ist verbunden (`src/app/(app)/resume/page.tsx` nutzt `getJobPostingText`).

- **Übergabe an den Lebenslauf (5.2):** Feature A hält pro Nutzer drei Lebensläufe (finance, consulting, startup) und schneidet auf den Bereich zu, nicht auf eine einzelne Anzeige.
  - Der Button verlinkt auf `/resume?jobId=<id>&track=<bereich>`. A liest `track` schon heute aus der URL, damit ist der passende Lebenslauf ohne weiteren Code vorausgewählt.
  - Für die Rolle stellt `src/lib/jobs/handoff.ts` `getJobPostingText(id)` bereit, mit der vereinbarten Signatur plus dem Feld `track` (kann `null` sein). Die Funktion prüft selbst, ob `id` eine UUID ist, und gibt sonst `null` zurück.
  - In `src/app/(app)/resume/page.tsx` steht dafür ein `TODO(merge)` von Feature A. Beim Merge ungefähr so:
  ```tsx
  const { jobId } = await searchParams;
  const job = typeof jobId === "string" ? await getJobPostingText(jobId) : null;
  // Stellentitel → Rolle, Bereich → Lebenslauf:
  // <ResumeStartForm … initialRole={job?.title} />, initialTrack = job?.track ?? (track aus der URL)
  ```
- **Profilquelle:** `src/lib/jobs/profile-source.ts` ist die **einzige** Stelle, die weiß, woher das Profil kommt (`activeSource`, markiert mit `TODO(merge)`). Bis das Onboarding echte Profile speichert, bekommt **jeder Nutzer das Beispielprofil** aus `src/lib/jobs/fixtures/candidate-profile.example.json`, genau wie in Feature A (`src/lib/resume/profile-source.ts`). Beim Merge beide `activeSource` auf dieselbe echte Quelle umstellen. `load(userId)` muss das Profil-JSON im finalen Format liefern (oder `null`); den Rest übernimmt `toJobPreferences`.
- **Schema 5.2:** `jobPostingSchema` hat zusätzlich die Felder `employmentType` (nullable) und `insights`. Feature A hängt nicht davon ab.
- **XP:** Feature C vergibt kein XP.

## 7. Bekannte Lücken / TODOs

- **Stand der Prüfung (außerhalb des Repos, gegen Platzhalter der gemeinsamen Dateien):**
  - Geprüft: TypeScript-Typprüfung, 46 Unit-Tests (`test:jobs`), 14 RLS-Tests (`db:test:jobs`), ESLint mit der Standardkonfiguration von Next 16 (`core-web-vitals` + `typescript`, ohne Befund) und einzelne Live-Abfragen gegen die Quellen.
  - **Nicht** geprüft: `npm run build`, ein echtes Supabase-Projekt, echte Gemma-Aufrufe und die Oberfläche im Browser.
- **Ungeprüfte Annahmen über gemeinsame Dateien:** Gebaut wurde außerhalb des Repos, gegen Platzhalter. Beim Einspielen bitte prüfen:
  - `apiError(status, message)` und `apiOk(body)` liefern eine `Response`, und `apiError` liefert JSON mit dem Feld `error`. Das Frontend liest die Fehlermeldung aus `body.error`, siehe `src/components/jobs/jobs-api.ts`.
  - `readJson(request)` liefert den geparsten Body bzw. `null`.
  - `getCurrentUser()` liefert den User oder `null`.
  - `createClient()` und `createAdminClient()` werden mit `await` aufgerufen; das funktioniert, egal ob sie synchron oder asynchron sind.
  - Benutzt werden die shadcn-Komponenten `button` (inklusive `buttonVariants`), `input`, `card` (`Card`, `CardHeader`, `CardTitle`, `CardContent`) und `badge`. Fehlende bitte per `npx shadcn add <name>` ergänzen.
  - `cn` kommt aus `@/lib/utils`.
  - `generateJson(schema, { tier, system, prompt, check })` aus `@/lib/llm`, genutzt in `src/lib/jobs/outlook.ts`, mit derselben Signatur, wie Feature A sie nutzt.
- Typen: Nach den Migrationen `npm run db:types` ausführen, sonst kennt der Supabase-Client die neuen Tabellen nicht.
- Die Bereichs-Zuordnung (Track) läuft weiter rein über Stichwörter (`src/lib/jobs/normalize.ts`). Gemma wird nur für die Einschätzung genutzt.
- **Einschätzung ohne Kennzeichnung:** Die Werte von Gemma (Vorlauf, Bewerbungszeitraum, Andrang, Tipp) sind nicht überprüft und können falsch sein. In der Oberfläche sind sie nur als Näherung formuliert („ca.“), nicht als Schätzung von Gemma gekennzeichnet. **Entschieden von David am 2026-10-24:** Das bleibt so.
- **Bewerbungsfenster:** Wann eine Firma tatsächlich Stellen öffnet, lässt sich nur über tägliche Snapshots der Anzeigen über Monate ermitteln. Das bräuchte einen Cron-Job, den TEAM-KONTEXT im ersten Schritt nicht vorsieht. Bis dahin kommt der Vorlauf aus einzelnen BA-Anzeigen (Veröffentlichung → Start) oder aus der Gemma-Schätzung.
- Bundesagentur: Filtern nach Arbeitgeber funktioniert nicht, der Parameter `arbeitgeber` liefert immer 0 Treffer. Firmen werden nur gefunden, wenn ihr Name in Titel oder Beruf vorkommt; PwC schreibt dort aktuell gar keine Praktika aus.
- StepStone-Gehälter sind Schätzungen von StepStone selbst (`salaryType: "Predicted"`). LinkedIn-Bewerberzahlen zählen Klicks auf „Bewerben“, nicht eingegangene Bewerbungen.
- StepStone liefert bei unbekannten Begriffen (z. B. Firmennamen) allgemeine Anzeigen. Deshalb filtert der Adapter auf Treffer, in denen jedes Suchwort in Titel, Firma oder Snippet vorkommt (mit einfacher Wortstamm-Kürzung, „Consulting“ findet also auch „Consultant“).
- Arbeitnow filtert nur die neuesten ~600 Stellen lokal, deshalb gibt es bei spezifischen Suchen oft 0 Treffer.
- Alte Zeilen in `job_postings`, `job_search_cache` und `job_outlook_cache` werden nicht aufgeräumt; dafür wäre später ein Cron-Job nötig.
- Der Abstand zwischen Anfragen an denselben Host (1 s) gilt nur pro Server-Instanz. Das genügt lokal, auf Vercel nicht.
- Die LinkedIn- und Indeed-Fixtures sind synthetisch (Dateien `*.synthetic.html`); echte Trefferseiten wurden meist blockiert.
