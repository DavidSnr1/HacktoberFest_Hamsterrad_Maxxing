# Karrierecoach

Webapp, die Studierende und Berufseinsteiger auf Bewerbungen vorbereitet – mit Mock-Interviews, einem auf die Stelle zugeschnittenen Lebenslauf und einem Charakter, der mit jeder Übung aufsteigt.

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui, Supabase (Auth + Datenbank), Gemma 4 über die Gemini API, ElevenLabs.

## Stand

- [x] Schritt 1 – Grundgerüst: Navigation, Login per Magic Link, geschützte Routen
- [x] Schritt 2 – Datenbank: Tabellen mit Row Level Security, Einwilligungs-Dialog
- [x] Schritt 3 – Interview-Prototyp (Consulting): Track-Auswahl, vorgelesene Fragen (ElevenLabs), Aufnahme und Transkription
- [x] Schritt 4 – Feedback: Auswertung mit Gemma 4 nach Raster, Feedback-Seite, XP
- [ ] Schritt 5 – Weitere Tracks
- [ ] Schritt 6 – Lebenslauf-Tab
- [ ] Schritt 7 – Charakter-Tab
- [ ] Schritt 8 – Feinschliff

## Voraussetzungen

- Node.js 22 oder neuer (`node -v`)
- Ein kostenloses Konto bei [Supabase](https://supabase.com)

## 1. Supabase-Projekt anlegen

1. Im [Supabase-Dashboard](https://supabase.com/dashboard) auf **New project** klicken.
2. Als **Region** „Central EU (Frankfurt)" wählen (DSGVO).
3. Wenn das Projekt bereit ist: **Project Settings → API** (bzw. **API Keys**) öffnen und notieren:
   - **Project URL**
   - **anon / public key**
   - **service_role key** (geheim, nur serverseitig – wird ab Schritt 2 gebraucht)
4. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000`
   - Unter **Redirect URLs** hinzufügen: `http://localhost:3000/auth/callback`
5. **Authentication → Sign In / Providers → Email** muss aktiviert sein (Standard).

> Hinweis: Supabase verschickt über den eingebauten Mailserver nur wenige E-Mails pro Stunde. Für Tests reicht das; für den Live-Betrieb später einen eigenen SMTP-Server eintragen.

## 2. Umgebungsvariablen

```bash
cp .env.example .env.local
```

Dann in `.env.local` mindestens eintragen:

```
NEXT_PUBLIC_SUPABASE_URL=https://<dein-projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Die übrigen Variablen (Gemini, ElevenLabs) werden in späteren Schritten gebraucht. `.env.local` ist in `.gitignore` und landet nie im Git.

| Variable | Wofür | Ab Schritt |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Login, Datenbank | 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverseitige Schreibzugriffe (Feedback, XP) und Daten löschen | 4 |
| `GEMINI_API_KEY`, `LLM_MODEL_LIVE`, `LLM_MODEL_QUALITY` | Gemma 4 für Feedback und Lebenslauf | 4 |
| `ELEVENLABS_API_KEY` | Fragen vorlesen (Text to Speech), Antworten transkribieren (Speech to Text) | 3 |
| `ELEVENLABS_VOICE_ID` (optional) | Andere Stimme für die Interviewerin | 3 |
| `DID_API_KEY` (optional) | Sprechendes Interviewer-Video aus einem Foto (D-ID) | – |

## 3. Datenbank einrichten

Das Schema liegt als SQL-Migrationen unter `supabase/migrations/`. Eingespielt werden sie mit einem Befehl:

1. Datenbank-Verbindung in `.env.local` eintragen:
   ```
   SUPABASE_DB_URL=postgresql://postgres:DEIN_DB_PASSWORT@db.<projekt-id>.supabase.co:5432/postgres
   ```
   Das Datenbank-Passwort legst du unter **Project Settings → Database** fest (bei Bedarf „Reset database password"). Am besten nur Buchstaben und Ziffern verwenden, Sonderzeichen stören in der Adresse.
2. Migrationen einspielen:
   ```bash
   npm run db:migrate
   ```
   Das Skript spielt alle noch fehlenden Migrationen in der Reihenfolge der Dateinamen ein, jede in einer eigenen Transaktion, und merkt sich in `app_private.schema_migrations`, was schon gelaufen ist. Mehrfaches Ausführen ist unbedenklich.

Ist die direkte Adresse (nur IPv6) aus deinem Netz nicht erreichbar, nutzt das Skript automatisch den Session Pooler von Supabase und findet die Region selbst. Alternativ lässt sich jede Datei auch von Hand im **SQL Editor** des Dashboards ausführen.

Kontrolle: Unter **Table Editor** gibt es die Tabellen `profiles`, `interviews`, `interview_feedback`, `resumes`, `experiences`, `tailored_resumes`, `xp_events` und `consents`, jeweils mit aktivem RLS.

### Zugriffsregeln (Row Level Security)

- Jede Tabelle ist auf den angemeldeten Nutzer beschränkt: Man sieht und ändert nur eigene Zeilen.
- `xp_events` und `interview_feedback` sind für Nutzer **nur lesbar**. Nur der Server (Service Role) schreibt sie, damit niemand sich XP selbst gutschreiben kann.
- Nicht angemeldete Besucher haben keinen Zugriff auf irgendeine Tabelle.
- Wird ein Nutzer gelöscht, werden alle seine Daten automatisch mitgelöscht.

### Migration testen (ohne Supabase-Projekt)

```bash
npm run db:test
```

Spielt alle Migrationen in eine eingebettete Test-Datenbank (PGlite) ein und prüft Zugriffsregeln, Rechte und Constraints.

### TypeScript-Typen

`src/lib/supabase/database.types.ts` enthält die Typen für alle Tabellen. Nach Schema-Änderungen neu erzeugen (einmalig `npx supabase login`, die Projekt-ID steht in der Projekt-URL):

```bash
SUPABASE_PROJECT_ID=<projekt-id> npm run db:types
```

## 4. Starten

```bash
npm install
npm run dev
```

App öffnen: <http://localhost:3000>

Weitere Befehle:

```bash
npm run build   # Produktions-Build
npm run lint    # ESLint
```

## Projektstruktur (Auszug)

```
src/
  proxy.ts                    # Next.js Proxy (früher Middleware): Session erneuern, Gäste umleiten
  app/
    (auth)/login/             # Login per Magic Link
    (app)/                    # Geschützter Bereich mit Tab-Navigation
      character/ interviews/ resume/
    auth/callback/route.ts    # Verarbeitet den Link aus der E-Mail
    auth/signout/route.ts     # Abmelden (POST)
  components/                 # App-Komponenten, ui/ = shadcn/ui
  lib/supabase/               # Supabase-Clients und Datenbank-Typen
  lib/consent/                # Einwilligungstexte, Prüfung und Speichern
  lib/interview/              # Tracks, Fragenablauf, Mikrofon/Kamera, Feedback, Datenbankabfragen
  lib/prompts/                # Fragenkataloge, Bewertungsraster, Feedback-Prompt
  lib/schemas/                # Zod-Schemas für API-Eingaben
  lib/elevenlabs.ts           # Text-to-Speech und Speech-to-Text (nur serverseitig)
  lib/llm.ts                  # einzige Schicht für Gemma-4-Aufrufe
  lib/gamification/xp.ts      # XP-Regeln und Vergabe
  components/interview/       # Interview-Raum im Video-Call-Look
  app/api/                    # API-Routen (Interview anlegen, Antworten, beenden, Feedback, Sprachausgabe)
supabase/
  migrations/                 # SQL-Migrationen (Schema + RLS)
  tests/                      # Test der Migrationen (npm run db:test)
```

## KI-Feedback (Gemma 4)

Nach einem Interview bewertet Gemma 4 das Transkript nach einem Raster (Skala 1–5): Struktur, inhaltliche Tiefe, Überzeugungskraft, Sprechweise und ein Track-Kriterium (Consulting: Case-Struktur). Dazu kommen 3 Stärken, 3 Verbesserungen und ein Übungsvorschlag.

- **Ablauf:** Beim Beenden wird das Transkript sofort gespeichert. Die Auswertung läuft danach im Hintergrund (1–3 Minuten). Die Feedback-Seite zeigt so lange „Auswertung wird erstellt" und aktualisiert sich selbst. Klappt es nicht, gibt es einen Button für einen neuen Versuch.
- **Modelle:** Zuerst `LLM_MODEL_QUALITY` (Gemma 4 31B). Antwortet es nicht oder zu langsam, springt automatisch `LLM_MODEL_LIVE` (Gemma 4 26B) ein. Alle Aufrufe laufen über `src/lib/llm.ts`.
- **Gegen Erfindungen:** Zitate werden gegen das Transkript geprüft; nicht wörtlich vorhandene Zitate führen zu einem neuen Versuch. Den Gesamtscore berechnet die App selbst als gewichteten Durchschnitt.
- **Voraussetzungen:** `GEMINI_API_KEY` und `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (Feedback und XP darf nur der Server schreiben).
- **Raster anpassen:** in `src/lib/prompts/feedback-rubrics.ts` (Beschreibungen, Anker, Gewichte). Bei Änderungen `RUBRIC_VERSION` erhöhen.
- **Ausprobieren ohne Interview:**

  ```bash
  npm run feedback:try
  ```

  Wertet das Beispiel-Transkript `scripts/fixtures/consulting-transcript.json` mit den echten Modellen aus und gibt das Ergebnis aus. Nichts wird gespeichert. Mit eigenem Transkript: `npm run feedback:try -- pfad/zur/datei.json consulting`.

> Datenschutz: Im kostenlosen Tarif der Gemini API darf Google gesendete Inhalte zur Produktverbesserung nutzen. Vor dem Einsatz mit echten Nutzern in Google AI Studio die Abrechnung aktivieren (bezahlter Tarif) und die aktuellen Nutzungsbedingungen prüfen.

## Einwilligungen (DSGVO)

Vor der ersten Sprachaufnahme und vor dem ersten Lebenslauf-Upload erscheint ein Einwilligungs-Dialog. Die Zustimmung wird in `consents` mit der Version des Textes gespeichert. Ändern sich die Texte in `src/lib/consent/policy.ts` wesentlich, `CONSENT_POLICY_VERSION` erhöhen, dann wird erneut gefragt. Die Texte sind ein Entwurf und sollten zusammen mit der Datenschutzerklärung geprüft werden.

## Interview-Format und ElevenLabs

Das Interview ist ein **One-Way-Videointerview**: Die Interviewerin liest jede Frage vor, du hast kurz Bedenkzeit und antwortest dann in die Kamera. Nachfragen gibt es keine. Der Case kommt deshalb mit allen Zahlen auf einmal.

### Ablauf

1. **Interview starten** prüft die Sprach-Einwilligung und legt das Interview an (`POST /api/interviews`).
2. Der Browser fragt nach dem Mikrofon. Die Interviewerin begrüßt dich.
3. Pro Frage: Frage wird vorgelesen → Bedenkzeit (Countdown, „Jetzt antworten" startet sofort) → Aufnahme mit Zeitlimit → Antwort wird an `POST /api/interviews/[id]/answers` geschickt, von ElevenLabs in Text umgewandelt und im Transkript gespeichert. Die Audioaufnahme wird nicht gespeichert.
4. Nach der letzten Frage verabschiedet sich die Interviewerin, das Interview wird abgeschlossen und das Feedback im Hintergrund erstellt.

Wird ein Interview unterbrochen (Tab geschlossen), sind die bisherigen Antworten gespeichert. Beim nächsten Öffnen geht es mit der nächsten unbeantworteten Frage weiter.

Die Fragen stehen in `src/lib/prompts/interviewer-consulting.ts` (Text, Bedenkzeit, Antwortzeit). Die vorgelesenen Texte werden einmal erzeugt und dann zwischengespeichert, das spart ElevenLabs-Credits.

### ElevenLabs-Key einrichten

1. Auf [elevenlabs.io](https://elevenlabs.io) anmelden → unten links Profil → **API Keys** → **Create API Key**.
2. Berechtigungen: **Text to Speech** und **Speech to Text** erlauben, alles andere darf aus bleiben. Optional ein Credit-Limit setzen.
3. Den Key (beginnt mit `sk_`) in `.env.local` eintragen: `ELEVENLABS_API_KEY=sk_...` (ohne Leerzeichen oder Anführungszeichen).
4. Optional eine andere Stimme: in der ElevenLabs **Voice Library** eine deutschsprachige Stimme auswählen, die **Voice ID** kopieren und als `ELEVENLABS_VOICE_ID` eintragen. Ohne Eintrag wird eine Standardstimme verwendet.
5. Dev-Server neu starten.

Ein ElevenLabs-Agent im Dashboard ist nicht nötig.

## Interviewer-Video (D-ID, optional)

Statt der gezeichneten Interviewerin kann ein echtes Foto sprechen. Pro vorgelesener Zeile (Begrüßung, Fragen, Abschluss) wird **einmalig** ein kurzes Video erzeugt, in dem das Foto lippensynchron die ElevenLabs-Stimme spricht. Die Clips liegen in Supabase Storage und werden im Interview stumm zur Stimme abgespielt. Im Interview entstehen dadurch keine Wartezeit und keine Kosten.

> Nur Fotos von Personen verwenden, die der Nutzung schriftlich zugestimmt haben. Das Video ist in der App als „KI-generiertes Video" gekennzeichnet. Das Foto wird an D-ID übertragen; wir speichern es nicht.

1. Auf [d-id.com](https://www.d-id.com) ein Konto anlegen (Testguthaben reicht für die rund 7 Clips eines Tracks; im Gratis-Tarif ggf. mit Wasserzeichen).
2. Im D-ID Studio: Profil → **API Keys** → **Create**. Den Key (Form `benutzer:passwort`) in `.env.local` eintragen: `DID_API_KEY=...`
3. Foto in den Ordner `private/` legen (steht in `.gitignore`, landet nicht im Git). JPG oder PNG, Gesicht frontal und gut ausgeleuchtet, max. 10 MB.
4. Clips erzeugen (dauert pro Clip ca. 30–90 Sekunden):

   ```bash
   npm run videos:generate -- --track consulting --photo private/interviewer.jpg
   ```

   Das Skript legt beim ersten Mal den privaten Bucket `interviewer-videos` an. Vorhandene Clips werden übersprungen.
5. Interview neu laden: Die Interviewerin spricht jetzt als Video.

- **Fragentext oder Stimme geändert?** Skript erneut ausführen, es erzeugt nur die betroffenen Clips neu. Bis dahin erscheint für diese Zeilen wieder die gezeichnete Interviewerin.
- **Neues Foto?** Mit `--force` alle Clips des Tracks neu erzeugen.
- Name und Rolle der Interviewerin stehen in `src/lib/interview/tracks.ts`.
