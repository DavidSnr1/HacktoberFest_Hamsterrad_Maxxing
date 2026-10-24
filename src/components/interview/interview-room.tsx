"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CircleAlertIcon,
  HeadphonesIcon,
  Loader2Icon,
  MessageSquareTextIcon,
  MicIcon,
  RotateCcwIcon,
  SquareIcon,
  TimerIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { SubmitAnswerResponse } from "@/app/api/interviews/[id]/answers/route";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api";
import { openCamera, openMicrophone } from "@/lib/interview/media";
import type { InterviewQuestion, InterviewScript, SpeechItem } from "@/lib/interview/script";
import { TRACKS, type InterviewTrack } from "@/lib/interview/tracks";
import type { TranscriptEntry } from "@/lib/schemas/interview";
import { cn } from "@/lib/utils";
import { InterviewerAvatar } from "./interviewer-avatar";
import { InterviewerTile } from "./interviewer-tile";
import { SelfTile } from "./self-tile";
import { formatClock, TranscriptList } from "./transcript-list";
import { useInterviewAudio } from "./use-interview-audio";

type QuestionStep = "asking" | "prep" | "answering" | "processing" | "empty" | "upload-error";

type Phase =
  | { kind: "lobby"; error?: string }
  | { kind: "starting" }
  | { kind: "intro" }
  | { kind: "question"; index: number; step: QuestionStep; deadline?: number; message?: string }
  | { kind: "outro" }
  | { kind: "finishing" }
  | { kind: "finish-error"; message: string };

type InterviewRoomProps = {
  interviewId: string;
  track: InterviewTrack;
  script: InterviewScript;
  initialTranscript: TranscriptEntry[];
  /** Signed URLs of pre-rendered interviewer clips; lines without one show the avatar. */
  videoUrls: Partial<Record<SpeechItem, string>>;
};

type SpeechLine = { audio: string; video?: string };

async function errorMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as ApiError | null;
  return body?.error ?? fallback;
}

export function InterviewRoom({ interviewId, track, script, initialTranscript, videoUrls }: InterviewRoomProps) {
  const router = useRouter();
  const { interviewer, label } = TRACKS[track];
  const { questions } = script;
  const audio = useInterviewAudio();

  const [phase, setPhaseState] = useState<Phase>({ kind: "lobby" });
  const phaseRef = useRef<Phase>(phase);
  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const [transcript, setTranscript] = useState<TranscriptEntry[]>(initialTranscript);
  const [now, setNow] = useState(() => Date.now());
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const lastBlobRef = useRef<Blob | null>(null);
  const speechRef = useRef(new Map<SpeechItem, Promise<SpeechLine>>());
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const aliveRef = useRef(true);

  const answeredIds = useMemo(
    () => new Set(transcript.filter((e) => e.role === "candidate").map((e) => e.questionId)),
    [transcript],
  );
  const firstOpenIndex = questions.findIndex((q) => !answeredIds.has(q.id));
  const isResume = answeredIds.size > 0;

  useEffect(() => {
    aliveRef.current = true;
    const speech = speechRef.current;
    return () => {
      aliveRef.current = false;
      speech.forEach((line) =>
        line.then((urls) => {
          URL.revokeObjectURL(urls.audio);
          if (urls.video) URL.revokeObjectURL(urls.video);
        }, () => {}),
      );
    };
  }, []);

  /**
   * Fetches (once) and caches an interviewer line as object URLs: the audio
   * and, if there is one, the video. Both are fully loaded before playback,
   * so the muted video starts in sync with the voice.
   */
  const loadSpeech = useCallback(
    (item: SpeechItem) => {
      const cached = speechRef.current.get(item);
      if (cached) return cached;
      const videoUrl = videoUrls[item];
      // Separate URL for lines with video: their audio is the clip's MP3, not a cached TTS rendition.
      const audioUrl = `/api/elevenlabs/speech?track=${track}&item=${encodeURIComponent(item)}${videoUrl ? "&video=1" : ""}`;
      const promise = Promise.all([
        fetch(audioUrl).then(async (response) => {
          if (!response.ok) throw new Error(await errorMessage(response, "Die Sprachausgabe ist nicht erreichbar."));
          return URL.createObjectURL(await response.blob());
        }),
        // A missing video is not an error: the avatar is shown instead.
        videoUrl
          ? fetch(videoUrl)
              .then(async (response) => (response.ok ? URL.createObjectURL(await response.blob()) : undefined))
              .catch(() => undefined)
          : Promise.resolve(undefined),
      ]).then(([audio, video]): SpeechLine => ({ audio, video }));
      // Allow a retry on the next request if this one failed.
      promise.catch(() => speechRef.current.delete(item));
      speechRef.current.set(item, promise);
      return promise;
    },
    [track, videoUrls],
  );

  /** Plays a line; if audio fails the text on screen is enough to continue. */
  const speak = useCallback(
    async (item: SpeechItem) => {
      try {
        const line = await loadSpeech(item);
        setCurrentVideo(line.video ?? null);
        await audio.play(line.audio);
      } catch {
        // Ignore: playback blocked or TTS unavailable for this line.
      }
    },
    [audio, loadSpeech],
  );

  const finish = useCallback(async () => {
    setPhase({ kind: "finishing" });
    try {
      const response = await fetch(`/api/interviews/${interviewId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "finished" }),
      });
      if (!response.ok && response.status !== 409) {
        setPhase({
          kind: "finish-error",
          message: await errorMessage(response, "Das Interview konnte nicht abgeschlossen werden."),
        });
        return;
      }
      audio.stop();
      setCameraStream((stream) => {
        stream?.getTracks().forEach((t) => t.stop());
        return null;
      });
      router.replace(`/interviews/${interviewId}/feedback`);
    } catch {
      setPhase({ kind: "finish-error", message: "Keine Verbindung zum Server. Bitte versuche es erneut." });
    }
  }, [audio, interviewId, router, setPhase]);

  const goToQuestion = useCallback(
    async (index: number) => {
      if (!aliveRef.current) return;
      const question = questions[index];
      if (!question) {
        setPhase({ kind: "outro" });
        await speak("outro");
        if (aliveRef.current) await finish();
        return;
      }
      setPhase({ kind: "question", index, step: "asking" });
      // Preload the next line while this one plays.
      const next = questions[index + 1];
      void loadSpeech(next ? `q:${next.id}` : "outro").catch(() => {});
      await speak(`q:${question.id}`);
      if (!aliveRef.current || phaseRef.current.kind !== "question" || phaseRef.current.index !== index) return;
      setPhase({ kind: "question", index, step: "prep", deadline: Date.now() + question.prepSeconds * 1000 });
    },
    [finish, loadSpeech, questions, setPhase, speak],
  );

  const beginAnswer = useCallback(
    (index: number) => {
      const question = questions[index];
      if (!question) return;
      audio.stopPlayback();
      audio.startRecording();
      setPhase({ kind: "question", index, step: "answering", deadline: Date.now() + question.answerSeconds * 1000 });
    },
    [audio, questions, setPhase],
  );

  const submitAnswer = useCallback(
    async (index: number, blob: Blob) => {
      const question = questions[index];
      if (!question) return;
      setPhase({ kind: "question", index, step: "processing" });
      const form = new FormData();
      form.append("questionId", question.id);
      form.append("audio", blob, "answer");
      try {
        const response = await fetch(`/api/interviews/${interviewId}/answers`, { method: "POST", body: form });
        if (!aliveRef.current) return;
        if (!response.ok) {
          setPhase({
            kind: "question",
            index,
            step: "upload-error",
            message: await errorMessage(response, "Deine Antwort konnte nicht verarbeitet werden."),
          });
          return;
        }
        const { text } = (await response.json()) as SubmitAnswerResponse;
        if (!text) {
          setPhase({ kind: "question", index, step: "empty" });
          return;
        }
        lastBlobRef.current = null;
        setTranscript((current) => [
          ...current.filter((e) => e.questionId !== question.id),
          { role: "interviewer", text: question.text, at: 0, questionId: question.id },
          { role: "candidate", text, at: 0, questionId: question.id },
        ]);
        void goToQuestion(index + 1);
      } catch {
        setPhase({
          kind: "question",
          index,
          step: "upload-error",
          message: "Keine Verbindung zum Server. Deine Aufnahme ist noch da, versuche es erneut.",
        });
      }
    },
    [goToQuestion, interviewId, questions, setPhase],
  );

  const endAnswer = useCallback(
    async (index: number) => {
      const blob = await audio.stopRecording();
      if (!blob) {
        setPhase({ kind: "question", index, step: "empty" });
        return;
      }
      lastBlobRef.current = blob;
      await submitAnswer(index, blob);
    },
    [audio, setPhase, submitAnswer],
  );

  async function startInterview() {
    audio.prime(); // Must run before any await (audio unlock on iOS).
    setPhase({ kind: "starting" });

    const mic = await openMicrophone();
    if (!mic.ok) {
      setPhase({ kind: "lobby", error: mic.message });
      return;
    }
    await audio.start(mic.stream);

    // The first line doubles as a check that the voice service works.
    try {
      await loadSpeech(isResume ? `q:${questions[firstOpenIndex]?.id}` : "intro");
    } catch (error) {
      audio.stop();
      setPhase({ kind: "lobby", error: error instanceof Error ? error.message : "Die Sprachausgabe ist nicht erreichbar." });
      return;
    }

    if (!isResume) {
      setPhase({ kind: "intro" });
      void loadSpeech(`q:${questions[0].id}`).catch(() => {});
      await speak("intro");
    }
    await goToQuestion(Math.max(0, firstOpenIndex));
  }

  // Countdown: ticks while a timed step runs and fires when it ends.
  const timedIndex = phase.kind === "question" ? phase.index : -1;
  const timedStep = phase.kind === "question" ? phase.step : null;
  const deadline = phase.kind === "question" ? phase.deadline : undefined;
  useEffect(() => {
    if (deadline === undefined || (timedStep !== "prep" && timedStep !== "answering")) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current < deadline) return;
      clearInterval(timer);
      if (timedStep === "prep") beginAnswer(timedIndex);
      else void endAnswer(timedIndex);
    }, 250);
    return () => clearInterval(timer);
  }, [deadline, timedStep, timedIndex, beginAnswer, endAnswer]);

  // Warn before leaving mid-interview (answers so far are already saved).
  const inProgress = !["lobby", "finishing"].includes(phase.kind);
  useEffect(() => {
    if (!inProgress) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [inProgress]);

  // Release the camera when it is switched off or the room unmounts.
  useEffect(() => () => cameraStream?.getTracks().forEach((t) => t.stop()), [cameraStream]);

  async function toggleCamera() {
    if (cameraStream) {
      setCameraStream(null);
      return;
    }
    const result = await openCamera();
    if (result.ok) setCameraStream(result.stream);
    else toast.error(result.message);
  }

  function endEarly() {
    if (!window.confirm("Interview jetzt beenden? Bisherige Antworten werden ausgewertet.")) return;
    audio.stopPlayback();
    void audio.stopRecording();
    void finish();
  }

  if (phase.kind === "lobby" || phase.kind === "starting") {
    return (
      <Lobby
        trackLabel={label}
        interviewerName={interviewer.name}
        interviewerRole={interviewer.role}
        questionCount={questions.length}
        resumeAt={isResume ? firstOpenIndex + 1 : undefined}
        error={phase.kind === "lobby" ? phase.error : undefined}
        starting={phase.kind === "starting"}
        onStart={startInterview}
      />
    );
  }

  if (phase.kind === "finishing" || phase.kind === "finish-error") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border px-6 py-10 text-center">
        <h1 className="text-lg font-semibold">
          {phase.kind === "finishing" ? "Interview wird abgeschlossen" : "Abschließen fehlgeschlagen"}
        </h1>
        <p className="text-sm text-muted-foreground" role="status">
          {phase.kind === "finishing" ? "Einen Moment, gleich geht es zu deiner Auswertung …" : phase.message}
        </p>
        {phase.kind === "finishing" ? (
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Button size="lg" className="h-10" onClick={finish}>
            Erneut versuchen
          </Button>
        )}
      </div>
    );
  }

  const question = phase.kind === "question" ? questions[phase.index] : undefined;
  const secondsLeft = deadline !== undefined ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium">Mock Interview · {label}</span>
        <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
          {audio.isRecording && (
            <span className="flex items-center gap-1.5 font-medium text-red-600">
              <span className="relative flex size-2.5" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
              </span>
              Aufnahme
            </span>
          )}
          <span>
            {phase.kind === "question" ? `Frage ${phase.index + 1} von ${questions.length}` : null}
            {phase.kind === "intro" ? "Begrüßung" : null}
            {phase.kind === "outro" ? "Abschluss" : null}
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          {/* Stage */}
          <div className="relative">
            <InterviewerTile
              name={interviewer.name}
              role={interviewer.role}
              isSpeaking={audio.isSpeaking}
              videoUrl={currentVideo}
              active
              getOutputVolume={audio.getOutputVolume}
              className="h-[min(42dvh,26rem)] min-h-64 lg:h-[min(50dvh,28rem)]"
            />
            <SelfTile
              cameraStream={cameraStream}
              isMuted={false}
              active
              getInputVolume={audio.getInputVolume}
              className="absolute top-3 right-3 h-28 w-20 sm:h-32 sm:w-44"
            />
          </div>

          {/* Question and step controls */}
          <QuestionPanel
            phase={phase}
            question={question}
            introText={script.intro}
            outroText={script.outro}
            interviewerName={interviewer.name}
            secondsLeft={secondsLeft}
            onAnswerNow={() => phase.kind === "question" && beginAnswer(phase.index)}
            onStopAnswer={() => phase.kind === "question" && void endAnswer(phase.index)}
            onSkipReading={audio.stopPlayback}
            onReplay={() => question && void speak(`q:${question.id}`)}
            onRecordAgain={() => phase.kind === "question" && beginAnswer(phase.index)}
            onRetryUpload={() => {
              if (phase.kind === "question" && lastBlobRef.current) void submitAnswer(phase.index, lastBlobRef.current);
            }}
            onSkipQuestion={() => phase.kind === "question" && void goToQuestion(phase.index + 1)}
          />
        </div>

        {/* Answers so far */}
        <aside
          className={cn(
            "flex-col rounded-2xl border bg-background lg:flex lg:max-h-[calc(min(50dvh,28rem)+14rem)]",
            showTranscript ? "flex max-h-72" : "hidden",
          )}
          aria-label="Deine Antworten"
        >
          <div className="border-b px-4 py-2.5 text-sm font-medium">Deine Antworten</div>
          <div className="flex-1 overflow-y-auto p-4">
            {transcript.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nach jeder Antwort erscheint hier, was erkannt wurde.
              </p>
            ) : (
              <TranscriptList entries={transcript} interviewerName={interviewer.name} hideTimes />
            )}
          </div>
        </aside>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <Button
          variant="outline"
          size="icon-lg"
          className="size-12 rounded-full"
          onClick={toggleCamera}
          aria-label={cameraStream ? "Eigenansicht ausschalten" : "Eigenansicht einschalten"}
          aria-pressed={Boolean(cameraStream)}
        >
          {cameraStream ? <VideoIcon /> : <VideoOffIcon />}
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          className="size-12 rounded-full lg:hidden"
          onClick={() => setShowTranscript((v) => !v)}
          aria-label={showTranscript ? "Antworten ausblenden" : "Antworten anzeigen"}
          aria-pressed={showTranscript}
        >
          <MessageSquareTextIcon />
        </Button>
        <Button variant="outline" size="lg" className="h-12 rounded-full px-5" onClick={endEarly}>
          Interview beenden
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Die Eigenansicht bleibt in deinem Browser. Aufgenommen wird nur der Ton deiner Antworten, um ihn
        in Text umzuwandeln. Die Aufnahme selbst wird nicht gespeichert.
      </p>
    </div>
  );
}

type QuestionPanelProps = {
  phase: Phase;
  question: InterviewQuestion | undefined;
  introText: string;
  outroText: string;
  interviewerName: string;
  secondsLeft: number;
  onAnswerNow: () => void;
  onStopAnswer: () => void;
  onSkipReading: () => void;
  onReplay: () => void;
  onRecordAgain: () => void;
  onRetryUpload: () => void;
  onSkipQuestion: () => void;
};

function QuestionPanel(props: QuestionPanelProps) {
  const { phase, question, secondsLeft } = props;

  if (phase.kind === "intro" || phase.kind === "outro" || phase.kind === "starting") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border p-4">
        <p className="text-sm leading-relaxed">{phase.kind === "outro" ? props.outroText : props.introText}</p>
        {phase.kind === "intro" && (
          <Button variant="ghost" size="sm" className="self-start" onClick={props.onSkipReading}>
            Begrüßung überspringen
          </Button>
        )}
      </div>
    );
  }
  if (phase.kind !== "question" || !question) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border p-4" aria-live="polite">
      <p className="leading-relaxed font-medium">{question.text}</p>

      {phase.step === "asking" && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{props.interviewerName} stellt die Frage …</span>
          <Button variant="ghost" size="sm" onClick={props.onSkipReading}>
            Vorlesen überspringen
          </Button>
        </div>
      )}

      {phase.step === "prep" && (
        <div className="flex flex-col gap-3">
          <Countdown label="Bedenkzeit" seconds={secondsLeft} />
          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="h-11 flex-1" onClick={props.onAnswerNow}>
              <MicIcon aria-hidden />
              Jetzt antworten
            </Button>
            <Button variant="outline" size="lg" className="h-11" onClick={props.onReplay}>
              <RotateCcwIcon aria-hidden />
              Nochmal anhören
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Nach Ablauf der Bedenkzeit startet die Aufnahme automatisch.</p>
        </div>
      )}

      {phase.step === "answering" && (
        <div className="flex flex-col gap-3">
          <Countdown label="Verbleibende Antwortzeit" seconds={secondsLeft} recording />
          <Button size="lg" className="h-11 bg-red-600 text-white hover:bg-red-700" onClick={props.onStopAnswer}>
            <SquareIcon className="fill-current" aria-hidden />
            Antwort beenden
          </Button>
        </div>
      )}

      {phase.step === "processing" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          Deine Antwort wird in Text umgewandelt …
        </p>
      )}

      {(phase.step === "empty" || phase.step === "upload-error") && (
        <div className="flex flex-col gap-3">
          <p className="flex gap-2 text-sm text-destructive" role="alert">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {phase.step === "empty"
              ? "Wir konnten in deiner Antwort nichts verstehen. Prüfe dein Mikrofon und nimm die Antwort erneut auf."
              : phase.message}
          </p>
          <div className="flex flex-wrap gap-2">
            {phase.step === "upload-error" && (
              <Button size="lg" className="h-11" onClick={props.onRetryUpload}>
                Erneut senden
              </Button>
            )}
            <Button
              variant={phase.step === "empty" ? "default" : "outline"}
              size="lg"
              className="h-11"
              onClick={props.onRecordAgain}
            >
              <MicIcon aria-hidden />
              Neu aufnehmen
            </Button>
            <Button variant="ghost" size="lg" className="h-11" onClick={props.onSkipQuestion}>
              Frage überspringen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Countdown({ label, seconds, recording }: { label: string; seconds: number; recording?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <TimerIcon className="size-4" aria-hidden />
        {label}
      </span>
      <span className={cn("font-mono text-lg tabular-nums", recording && seconds <= 15 && "text-red-600")}>
        {formatClock(seconds)}
      </span>
    </div>
  );
}

type LobbyProps = {
  trackLabel: string;
  interviewerName: string;
  interviewerRole: string;
  questionCount: number;
  resumeAt?: number;
  error?: string;
  starting: boolean;
  onStart: () => void;
};

function Lobby(props: LobbyProps) {
  const { trackLabel, interviewerName, interviewerRole, questionCount, resumeAt, error, starting, onStart } = props;
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <Link
        href="/interviews"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        Zurück zur Übersicht
      </Link>

      <div className="flex flex-col items-center gap-3 text-center">
        <InterviewerAvatar className="size-24 rounded-full" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mock Interview · {trackLabel}</h1>
          <p className="text-sm text-muted-foreground">
            mit {interviewerName}, {interviewerRole}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
        <li className="flex gap-3">
          <MessageSquareTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          {questionCount} Fragen. Jede wird vorgelesen, dann hast du kurz Bedenkzeit und antwortest in die
          Kamera. Nachfragen gibt es keine.
        </li>
        <li className="flex gap-3">
          <TimerIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          Plane etwa 15 Minuten ein. Jede Antwort hat ein Zeitlimit, das du siehst.
        </li>
        <li className="flex gap-3">
          <HeadphonesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          Such dir einen ruhigen Ort und stell den Ton an. Dein Browser fragt gleich nach dem Mikrofon.
        </li>
      </ul>

      {resumeAt && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm">
          Du hast dieses Interview schon begonnen. Es geht weiter mit Frage {resumeAt}.
        </p>
      )}

      {error && (
        <div className="flex gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      <Button size="lg" className="h-11" onClick={onStart} disabled={starting}>
        {starting && <Loader2Icon className="animate-spin" aria-hidden />}
        {starting ? "Wird vorbereitet …" : error ? "Erneut versuchen" : resumeAt ? "Interview fortsetzen" : "Interview beginnen"}
      </Button>
    </div>
  );
}
