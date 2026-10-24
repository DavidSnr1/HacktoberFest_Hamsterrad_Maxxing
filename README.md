# Karrierecoach

Webapp, die Studierende und Berufseinsteiger auf Bewerbungen vorbereitet – mit Mock-Interviews, einem auf die Stelle zugeschnittenen Lebenslauf und einem Charakter, der mit jeder Übung aufsteigt.

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui, Supabase (Auth + Datenbank), Gemma 4 über die Gemini API, ElevenLabs.

## Stand

- [x] Schritt 1 – Grundgerüst: Navigation, Login per Magic Link, geschützte Routen
- [ ] Schritt 2 – Datenbank
- [ ] Schritt 3 – Interview-Prototyp (Consulting)
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
| `SUPABASE_SERVICE_ROLE_KEY` | Serverseitige Admin-Aufgaben (z. B. Daten löschen) | 2 |
| `GEMINI_API_KEY`, `LLM_MODEL_LIVE`, `LLM_MODEL_QUALITY` | Gemma 4 für Feedback und Lebenslauf | 4 |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID_*` | Interviewer-Stimme, Spracherkennung | 3 |

## 3. Starten

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
  lib/supabase/               # Supabase-Clients für Browser, Server und Proxy
```

## ElevenLabs-Agenten einrichten

Folgt in Schritt 3.
