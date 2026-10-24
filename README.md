# Karrierecoach

Webapp, die Studierende und Berufseinsteiger auf Bewerbungen vorbereitet – mit Mock-Interviews, einem auf die Stelle zugeschnittenen Lebenslauf und einem Charakter, der mit jeder Übung aufsteigt.

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui, Supabase (Auth + Datenbank), Gemma 4 über die Gemini API, ElevenLabs.

## Stand

- [x] Schritt 1 – Grundgerüst: Navigation, Login per Magic Link, geschützte Routen
- [x] Schritt 2 – Datenbank: Tabellen mit Row Level Security, Einwilligungs-Dialog
- [x] Schritt 3 – Interview-Prototyp (Consulting): Track-Auswahl, Live-Interview mit ElevenLabs, Transkript
- [ ] Schritt 4 – Feedback
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
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID_*` | Interviewer-Stimme, Spracherkennung | 3 |

## 3. Datenbank einrichten

Das Schema liegt als SQL-Migration unter `supabase/migrations/`. So spielst du es ein (ohne zusätzliche Tools):

1. Im Supabase-Dashboard links **SQL Editor** öffnen, **New query**.
2. Den kompletten Inhalt von `supabase/migrations/20261024120000_initial_schema.sql` hineinkopieren.
3. **Run** klicken. Es sollte „Success. No rows returned" erscheinen.
4. Kontrolle: Unter **Table Editor** gibt es jetzt die Tabellen `profiles`, `interviews`, `interview_feedback`, `resumes`, `experiences`, `tailored_resumes`, `xp_events` und `consents`, jeweils mit dem Hinweis, dass RLS aktiv ist.

Die Migration nur **einmal** ausführen. Spätere Schema-Änderungen kommen als neue Dateien dazu und werden genauso nacheinander eingespielt.

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
  lib/interview/              # Track-Konfiguration, Mikrofon/Kamera, Datenbankabfragen
  lib/prompts/                # Interviewer-Prompts (werden ins ElevenLabs-Dashboard kopiert)
  lib/schemas/                # Zod-Schemas für API-Eingaben
  lib/elevenlabs.ts           # Signed URLs für die Agenten (nur serverseitig)
  components/interview/       # Interview-Raum im Video-Call-Look
  app/api/                    # API-Routen (Interview anlegen/beenden, Signed URL)
supabase/
  migrations/                 # SQL-Migrationen (Schema + RLS)
  tests/                      # Test der Migrationen (npm run db:test)
```

## Einwilligungen (DSGVO)

Vor der ersten Sprachaufnahme und vor dem ersten Lebenslauf-Upload erscheint ein Einwilligungs-Dialog. Die Zustimmung wird in `consents` mit der Version des Textes gespeichert. Ändern sich die Texte in `src/lib/consent/policy.ts` wesentlich, `CONSENT_POLICY_VERSION` erhöhen, dann wird erneut gefragt. Die Texte sind ein Entwurf und sollten zusammen mit der Datenschutzerklärung geprüft werden.

## ElevenLabs-Agenten einrichten

Jeder Track hat einen eigenen Agenten im ElevenLabs-Dashboard. Die App verbindet sich nur mit ihm, den Prompt pflegst du im Dashboard. Aktuell ist nur **Consulting** aktiv.

### 1. API-Key anlegen

1. Auf [elevenlabs.io](https://elevenlabs.io) registrieren bzw. anmelden.
2. Unten links auf dein Profil → **API Keys** → **Create API Key**.
3. Namen vergeben (z. B. „Karrierecoach lokal"). Bei den Berechtigungen den Zugriff auf **ElevenAgents** (Conversational AI) erlauben, alles andere darf aus bleiben.
4. Den Key in `.env.local` als `ELEVENLABS_API_KEY` eintragen. Er ist nur einmal sichtbar.

### 2. Consulting-Agenten erstellen

1. Im Dashboard links **Agents** öffnen → **Create agent** → **Blank template**. Name: „Karrierecoach – Consulting".
2. Prompt-Texte im Terminal ausgeben:

   ```bash
   npm run prompt -- consulting
   ```

3. Im Agenten unter **Agent**:
   - **Agent language**: Deutsch.
   - **First message**: den Text unter „First message" einfügen.
   - **System prompt**: den Text unter „System prompt" einfügen.
   - **LLM**: das Modell, mit dem der Agent das Gespräch führt. Es wird von ElevenLabs aufgerufen, nicht von der App. Für flüssige Gespräche ein schnelles Modell wählen (z. B. ein Gemini-Flash-Modell).
4. Unter **Voice** eine deutschsprachige, weibliche Stimme wählen, die zu „Lena Hartmann" passt. Als TTS-Modell ein mehrsprachiges Modell (z. B. Flash v2.5 oder Multilingual).
5. Unter **Tools** das System-Tool **End call** aktivieren. Damit legt die Interviewerin nach der Verabschiedung selbst auf, und die App speichert das Transkript automatisch.
6. Unter **Advanced** die **maximale Gesprächsdauer** auf 1800 Sekunden (30 Minuten) setzen.
7. Unter **Security** die **Authentifizierung aktivieren**. Dann kann der Agent nur über die Signed URL der App gestartet werden, nicht von Fremden mit der Agent-ID.
8. Datenschutz: Unter **Privacy** bzw. **Advanced** die Aufbewahrung von Gesprächen und Audio so kurz wie möglich einstellen bzw. das Speichern von Audio deaktivieren, falls dein Tarif das anbietet. Die App speichert selbst nur das Transkript.
9. Agent speichern (**Publish**). Die **Agent-ID** (beginnt mit `agent_`) kopieren und in `.env.local` als `ELEVENLABS_AGENT_ID_CONSULTING` eintragen.
10. Dev-Server neu starten.

Ändert sich der Prompt in `src/lib/prompts/interviewer-consulting.ts`, musst du ihn erneut ins Dashboard kopieren.

### So läuft ein Interview technisch

1. „Interview starten" prüft die Sprach-Einwilligung und legt eine Zeile in `interviews` an (`POST /api/interviews`).
2. Im Interview-Raum fragt der Browser nach dem Mikrofon. Danach holt die App beim Server eine kurzlebige Signed URL (`GET /api/elevenlabs/signed-url`). Der API-Key bleibt auf dem Server.
3. Der Browser verbindet sich mit dem Agenten. Das Transkript wird live mitgeschrieben.
4. Beim Beenden (Button oder Agent legt auf) speichert `POST /api/interviews/[id]/finish` Transkript und Dauer. Schließt man den Tab mitten im Gespräch, wird das bisherige Transkript als „abgebrochen" gesichert.
