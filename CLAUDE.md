# CLAUDE.md – Karrierecoach-Webapp

Diese Datei ist deine Arbeitsgrundlage. Lies sie vollständig, bevor du Code schreibst, und halte dich an die Regeln und die Reihenfolge der Bauschritte.

---

## 1. Produktvision

Eine Webapp, die Studierende und Berufseinsteiger auf Bewerbungen vorbereitet. Sie besteht aus drei Tabs:

### Tab 1 – Charakter (Gamification)
Ein Avatar, der sich durch Aktivität „upleveln" lässt.
- XP für: abgeschlossene Mock-Interviews, Qualität des Feedbacks, hochgeladene/angepasste Lebensläufe, tägliche Streaks.
- Levelsystem mit Titeln (z. B. „Bewerber-Rookie" → „Interview-Profi"), Badges und einem Avatar, der sich mit dem Level optisch verändert (SVG-Layer oder vorgefertigte Sprites).
- XP und Level werden **aus gespeicherten Aktivitäten abgeleitet**, nicht manuell hochgezählt.

### Tab 2 – Mock Interviews (wichtigster Tab)
- Nutzer wählt einen Track: **Startup**, **Consulting** oder **Finance**.
- Format: **One-Way-Videointerview** im Video-Call-Look (Interviewer-Bereich, Eigenansicht per Kamera optional, Countdown).
- Die Interviewerin liest jede Frage aus einem festen Fragenkatalog vor (**ElevenLabs Text-to-Speech**). Danach hat der Nutzer Bedenkzeit und antwortet per Kamera/Mikrofon innerhalb eines Zeitlimits. **Keine Anschlussfragen**, kein Live-Dialog.
- Jede Antwort wird aufgenommen, per **ElevenLabs Speech-to-Text** transkribiert und sofort gespeichert. Unterbrochene Interviews lassen sich bei der nächsten offenen Frage fortsetzen.
- Am Ende: Transkript + strukturiertes Feedback (Bewertung nach Raster, konkrete Verbesserungstipps).

### Tab 3 – Lebenslauf
- Nutzer spricht seine bisherigen Erfahrungen ein (Aufnahme → Transkription → strukturierte Erfahrungen).
- Nutzer lädt seinen Lebenslauf hoch (PDF/DOCX).
- Nutzer fügt eine Stellenanzeige ein (Text oder Link).
- Die App erstellt einen auf die Stelle zugeschnittenen Lebenslauf und exportiert ihn als DOCX und PDF.

---

## 2. Tech-Stack

| Bereich | Wahl |
|---|---|
| Framework | Next.js (App Router) mit TypeScript |
| Styling | Tailwind CSS (+ shadcn/ui für Komponenten) |
| Datenbank & Auth | Supabase (Region EU/Frankfurt), Row Level Security aktiv |
| LLM | Google Gemma 4 über die Gemini API (Google AI Studio bzw. Vertex AI). Modelle: `gemma-4-26b-a4b-it` (schnell) und `gemma-4-31b-it` (Qualität). Modellnamen nur über Umgebungsvariablen, nie hartcodieren |
| Fragen vorlesen (Interview) | ElevenLabs Text-to-Speech über eine Server-Route; vorgelesen werden nur feste Texte aus dem Fragenkatalog, das Audio wird serverseitig zwischengespeichert |
| Speech-to-Text (Interview-Antworten und Erfahrungs-Aufnahme) | ElevenLabs Speech-to-Text über eine Server-Route |
| Dokumente | `pdf-parse` oder `pdfjs-dist` (PDF lesen), `mammoth` (DOCX lesen), `docx` (DOCX erzeugen), PDF-Export aus dem erzeugten Dokument |
| Validierung | Zod für alle API-Eingaben und alle LLM-Ausgaben |
| Hosting | Vercel (EU-Region) |

Wenn du eine Abweichung für sinnvoll hältst, erkläre sie kurz und frage nach, bevor du sie umsetzt.

### Aufgabenteilung der KI-Dienste (verbindlich)

| Aufgabe | Dienst |
|---|---|
| Interview: Fragen vorlesen | **ElevenLabs Text-to-Speech** |
| Interview: Antworten transkribieren | **ElevenLabs Speech-to-Text** |
| Transkription der eingesprochenen Erfahrungen | **ElevenLabs Speech-to-Text** |
| Interview-Feedback nach dem Gespräch | **Gemma 4 31B** (`LLM_MODEL_QUALITY`), bei Ausfall automatisch Gemma 4 26B |
| Lebenslauf parsen und strukturieren | **Gemma 4 31B** |
| Eingesprochene Erfahrungen strukturieren | **Gemma 4 26B** (`LLM_MODEL_LIVE`) |
| Lebenslauf auf Stelle zuschneiden | **Gemma 4 31B** |

Gemma 4 (26B und 31B) verarbeitet nur **Text und Bilder**, kein Audio. Audio geht immer zuerst durch ElevenLabs, Gemma bekommt nur Text.

Alle Gemma-Aufrufe laufen über **eine einzige Schicht** in `src/lib/llm.ts` mit einer schlanken Schnittstelle, z. B. `generateText(...)` und `generateJson(schema, ...)`. Kein anderer Code ruft die Gemini API direkt auf. So lässt sich der Anbieter später (z. B. Vertex AI, selbst gehostetes Gemma oder ein anderes Modell) tauschen, ohne die App umzubauen. Die Schicht nutzt Gemmas native JSON-Ausgabe und validiert das Ergebnis mit Zod.

Erkenntnisse aus Tests mit der Gemini API (Stand Oktober 2026), in `llm.ts` bereits umgesetzt:
- JSON-Modus (`responseMimeType`) ja, aber **kein erzwungenes `responseJsonSchema`**: Damit gerät Gemma 4 in Wortschleifen. Das Schema steht im Prompt, Zod prüft.
- Temperatur 1.0 (Gemma-Empfehlung); niedrigere Werte begünstigten Schleifen. Längengrenze und Schleifenerkennung beim Streaming.
- Gemma ignoriert Einstellungen zur Denkzeit; eine Feedback-Auswertung dauert mit 31B ca. 1–2 Minuten. Deshalb läuft sie im Hintergrund (`after()`), die Feedback-Seite zeigt einen Wartezustand.
- 31B liefert zeitweise 500/503. Wiederholungen mit Zeitbudget, danach Fallback auf `LLM_MODEL_LIVE`.

---

## 3. Verbindliche Regeln

**Sicherheit**
- API-Keys (Google/Gemini, ElevenLabs, Supabase Service Role) **nur serverseitig**. Nie im Frontend, nie im Git. Lege eine `.env.example` ohne echte Werte an und trage `.env.local` in `.gitignore` ein.
- ElevenLabs wird **nur serverseitig** aufgerufen: Der Browser holt vorgelesene Fragen und schickt Aufnahmen über eigene API-Routen, er bekommt nie den API-Key. Die Sprachausgabe-Route akzeptiert nur IDs aus dem Fragenkatalog, keine freien Texte.
- Audio-Uploads: Typ und Größe prüfen (max. 4 MB pro Antwort wegen des Vercel-Limits von 4,5 MB; Aufnahme mit niedriger Bitrate).
- Alle Tabellen mit Nutzerdaten haben Row Level Security: Nutzer sehen nur ihre eigenen Zeilen.
- Uploads: Dateityp und Größe prüfen (max. 5 MB, nur PDF/DOCX).

**Datenschutz (DSGVO)**
- Vor der ersten Aufnahme und vor dem ersten Upload: Einwilligungs-Dialog (Stimme und Lebenslauf sind personenbezogene Daten).
- Funktion „Meine Daten löschen" (Konto, Transkripte, Lebensläufe, Audio) von Anfang an einplanen.
- Audio-Aufnahmen nicht dauerhaft speichern, sofern nicht ausdrücklich nötig. Transkripte genügen.
- Keine personenbezogenen Daten in Logs.

**Qualität des KI-Outputs**
- **Nichts erfinden.** Beim Lebenslauf darf das Modell ausschließlich Fakten aus dem hochgeladenen CV und den eingesprochenen Erfahrungen verwenden. Fehlt etwas, wird es als Rückfrage an den Nutzer markiert, nicht ergänzt.
- LLM-Ausgaben, die weiterverarbeitet werden, kommen als **JSON nach Zod-Schema** und werden validiert; bei Fehlern einmal automatisch erneut versuchen.
- Der Nutzer sieht den angepassten Lebenslauf **vor dem Export** und kann Änderungen annehmen oder ablehnen.

**Code**
- TypeScript strikt, keine `any`.
- Alle sichtbaren Texte auf **Deutsch**, Code und Kommentare auf Englisch.
- Eine Datei = eine Verantwortung. Prompts liegen in eigenen Dateien unter `src/lib/prompts/`, nicht verstreut im Code.
- Fehlerzustände und Ladezustände in der UI immer behandeln (Mikrofon verweigert, API-Fehler, leeres Transkript).
- Mobile-first: Das Interview muss auch am Handy bedienbar sein.

---

## 4. Projektstruktur (Ziel)

```
src/
  app/
    (auth)/login/
    (app)/
      character/page.tsx
      interviews/page.tsx
      interviews/[id]/page.tsx        # laufendes Interview (Vorlesen, Bedenkzeit, Aufnahme)
      interviews/[id]/feedback/page.tsx
      resume/page.tsx
    api/
      elevenlabs/speech/route.ts      # Fragen vorlesen (TTS, gecacht)
      interviews/route.ts             # Interview anlegen
      interviews/[id]/answers/route.ts  # Antwort hochladen → STT → Transkript
      interviews/[id]/finish/route.ts # Interview abschließen + Feedback im Hintergrund
      interviews/[id]/feedback/route.ts # Feedback erneut erzeugen
      resume/parse/route.ts
      resume/tailor/route.ts
      resume/export/route.ts
      experience/transcribe/route.ts
  lib/
    supabase/
    llm.ts                            # einzige Schicht für Gemma-4-Aufrufe
    elevenlabs.ts
    interview/script.ts               # Fragenkatalog-Typen, Zuordnung Track → Katalog
    prompts/
      interviewer-startup.ts          # Fragenkatalog (Begrüßung, Fragen, Verabschiedung)
      interviewer-consulting.ts
      interviewer-finance.ts
      feedback-rubrics.ts
      interview-feedback.ts           # Feedback-Prompt für Gemma
      resume-tailor.ts
    gamification/xp.ts
    schemas/                          # Zod-Schemas
  components/
supabase/migrations/
```

---

## 5. Datenmodell (Supabase)

- `profiles` (id → auth.users, display_name, created_at)
- `interviews` (id, user_id, track `startup|consulting|finance`, status `running|finished|aborted`, started_at, finished_at, transcript jsonb, duration_seconds). Transkript-Einträge: role `interviewer|candidate`, text, at, questionId
- `interview_feedback` (id, interview_id, scores jsonb, strengths text[], improvements text[], exercise text, summary text)
- `resumes` (id, user_id, original_text, parsed jsonb, created_at)
- `experiences` (id, user_id, raw_transcript, structured jsonb, created_at)
- `tailored_resumes` (id, user_id, resume_id, job_posting_text, result jsonb, created_at)
- `xp_events` (id, user_id, type, amount, ref_id, created_at)  → Level und XP werden daraus berechnet
- `consents` (id, user_id, type `voice|resume`, policy_version, granted_at). Bei geänderten Einwilligungstexten `CONSENT_POLICY_VERSION` erhöhen, dann wird neu gefragt

Lege alles als SQL-Migrationen unter `supabase/migrations/` an, mit RLS-Policies.

---

## 6. Interview-Logik pro Track

Jeder Track hat einen eigenen **Fragenkatalog** (`InterviewScript` in `src/lib/prompts/interviewer-<track>.ts`: Begrüßung, Fragen mit Bedenk- und Antwortzeit, Verabschiedung) und ein eigenes Bewertungsraster. Die Kataloge werden in `src/lib/interview/script.ts` registriert; ein Track ist erst startbar, wenn er dort einen Katalog hat und in `tracks.ts` aktiviert ist. Die Bewertungsraster verwendet Gemma 4 beim Feedback.

**Allgemein für alle Kataloge:** Realistisch, professionell, Ansprache mit „Sie“. Etwa 5 Fragen, Gesamtdauer ca. 15 Minuten. Fragen müssen **ohne Nachfragen** funktionieren: Verhaltensfragen nennen die erwarteten Bestandteile (Rolle, Vorgehen, Ergebnis), Cases enthalten alle nötigen Daten bereits in der Frage. IDs der Fragen nicht umbenennen, sie stehen in gespeicherten Transkripten.

- **Consulting:** Vorstellung, Motivation, Führung, Teamkonflikt, ein Profitabilitäts-Case mit allen Zahlen (laut rechnen, Empfehlung an den CEO).
- **Finance:** Fit-Fragen, Technical Questions (Accounting-Grundlagen, Bewertung/DCF, Multiples, aktuelle Marktthemen), eine Deal- oder Pitch-Frage.
- **Startup:** Motivation für Startups, Ownership-Beispiel, Produktdenken, Umgang mit Unsicherheit und Priorisierung, ein kleines Produkt- oder Growth-Szenario.

**Bewertungsraster (Skala 1–5, mit Kurzbegründung und Zitat aus dem Transkript):**
1. Struktur und Klarheit der Antworten
2. Inhaltliche Tiefe und Korrektheit
3. Überzeugungskraft und Beispiele (Ergebnisse, Zahlen)
4. Sprechweise (Füllwörter, Tempo, Prägnanz)
5. Track-spezifisch (Consulting: Case-Struktur; Finance: Fachwissen; Startup: Ownership)

Feedback-Ausgabe: Gesamtscore, 3 Stärken, 3 konkrete Verbesserungen, ein Übungsvorschlag.

Die Raster werden später von Fachleuten verfeinert. Halte sie deshalb **konfigurierbar** in `feedback-rubrics.ts`.

---

## 7. Umgebungsvariablen (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
LLM_MODEL_LIVE=gemma-4-26b-a4b-it
LLM_MODEL_QUALITY=gemma-4-31b-it
ELEVENLABS_API_KEY=
# Optional: voice of the interviewer (default: a premade ElevenLabs voice)
ELEVENLABS_VOICE_ID=
```

Der ElevenLabs-Key braucht nur die Berechtigungen **Text to Speech** und **Speech to Text**. Ein Agent im ElevenLabs-Dashboard ist nicht nötig. Die README enthält die Schritt-für-Schritt-Anleitung zum Key und zur optionalen Stimmenwahl.

---

## 8. Bauplan – Schritt für Schritt

**Arbeitsweise:** Arbeite immer nur **einen Schritt** ab. Erstelle zu Beginn jedes Schritts einen kurzen Plan, setze ihn um, teste ihn und erkläre mir am Ende in einfachen Worten, wie ich ihn lokal ausprobiere. Gehe erst zum nächsten Schritt, wenn ich „weiter" sage. Mache nach jedem funktionierenden Schritt einen Git-Commit.

**Schritt 1 – Grundgerüst**
Next.js + TypeScript + Tailwind + shadcn/ui, Navigation mit den Tabs Charakter, Interviews, Lebenslauf, Supabase-Login (E-Mail/Magic Link), geschützte Routen, `.env.example`, README mit Startanleitung. Tabs zeigen zunächst Platzhalter.

**Schritt 2 – Datenbank**
Migrationen für alle Tabellen aus Abschnitt 5 inkl. RLS, Einwilligungs-Dialog, Typen für Supabase generieren.

**Schritt 3 – Interview-Prototyp (nur Consulting)**
Track-Auswahlseite (alle drei Tracks sichtbar, nur Consulting aktiv). Interview-Seite im Video-Call-Look mit Interviewer-Karte (Avatarbild, Sprechanimation anhand des Audio-Pegels), Countdown, Aufnahme-Status, Button „Interview beenden". One-Way-Format: Fragen per ElevenLabs TTS vorlesen, Bedenkzeit, Antwort aufnehmen, per ElevenLabs STT transkribieren und pro Antwort in `interviews` speichern. Mikrofon-Berechtigung sauber abfangen.

**Schritt 4 – Feedback**
Route `finish`: Transkript an Gemma 4 31B über `llm.ts` (im Hintergrund), Bewertung nach Raster als validiertes JSON, speichern in `interview_feedback`, Feedback-Seite mit Scores, Stärken, Verbesserungen. XP-Event schreiben.

**Schritt 5 – Weitere Tracks**
Startup und Finance mit eigenen Fragenkatalogen und Rastern aktivieren. Kein neuer Architekturcode nötig, nur Konfiguration (Katalog anlegen, in `script.ts` registrieren, in `tracks.ts` aktivieren).

**Schritt 6 – Lebenslauf-Tab**
(a) Upload und Textextraktion, strukturiertes Parsing per Gemma 4 über `llm.ts`; (b) Erfahrungen einsprechen (Aufnahme → STT → Strukturierung); (c) Stellenanzeige einfügen; (d) Tailoring mit Vorher/Nachher-Ansicht und Annehmen/Ablehnen pro Änderung; (e) Export als DOCX und PDF.

**Schritt 7 – Charakter-Tab**
XP-Berechnung aus `xp_events`, Levelkurve, Badges, Streak-Logik, Avatar mit Level-abhängiger Optik, kleine Animation beim Level-up.

**Schritt 8 – Feinschliff**
Ladezustände, Fehlerbehandlung, Mobile-Test, Datenlöschung, Rate-Limits und eine Kostenübersicht pro Interview (geschätzte Minuten und Tokens loggen, ohne Inhalte).

---

## 9. Definition of Done pro Schritt

- Läuft lokal ohne Fehler (`npm run dev`), `npm run build` und `npm run lint` sind sauber.
- Keine Secrets im Code.
- Fehlerfälle sind in der UI sichtbar behandelt.
- README ist aktuell.
- Ich habe eine kurze Anleitung, wie ich den Schritt selbst teste.

---

## 10. Wenn etwas unklar ist

Frage nach, bevor du größere Annahmen triffst, besonders bei: Design-Richtung, Preismodell, Datenschutz-Entscheidungen und Änderungen am Tech-Stack. Kleine Entscheidungen triffst du selbst und nennst sie kurz in deiner Zusammenfassung.

---

## 11. Aktueller Stand

Schritte 1–4 sind erledigt; das Interview wurde danach auf das One-Way-Format umgestellt. Als Nächstes folgt **Schritt 5**.
