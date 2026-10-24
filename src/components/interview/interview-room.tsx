"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConversationProvider,
  useConversation,
  type DisconnectionDetails,
  type MessagePayload,
} from "@elevenlabs/react";
import {
  ArrowLeftIcon,
  CircleAlertIcon,
  HeadphonesIcon,
  Loader2Icon,
  MessageSquareTextIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  TimerIcon,
  VideoIcon,
  VideoOffIcon,
  VolumeXIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { SignedUrlResponse } from "@/app/api/elevenlabs/signed-url/route";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api";
import { checkMicrophone, openCamera } from "@/lib/interview/media";
import { TRACKS, type InterviewTrack } from "@/lib/interview/tracks";
import type { FinishInterviewInput, TranscriptEntry } from "@/lib/schemas/interview";
import { cn } from "@/lib/utils";
import { InterviewerAvatar } from "./interviewer-avatar";
import { InterviewerTile } from "./interviewer-tile";
import { SelfTile } from "./self-tile";
import { formatClock, TranscriptList } from "./transcript-list";

/** Hard stop as a safety net; the agent itself wraps up after about 18 minutes. */
const MAX_DURATION_SECONDS = 30 * 60;

type Phase =
  | { kind: "lobby"; error?: string }
  | { kind: "preparing"; step: "mic" | "connect" }
  | { kind: "live" }
  | { kind: "interrupted"; message: string }
  | { kind: "saving" }
  | { kind: "save-error"; message: string };

/** Live entry; responseId lets streamed or corrected agent messages replace each other. */
type LiveEntry = TranscriptEntry & { responseId?: string };

type InterviewRoomProps = { interviewId: string; track: InterviewTrack };

export function InterviewRoom(props: InterviewRoomProps) {
  return (
    <ConversationProvider>
      <Room {...props} />
    </ConversationProvider>
  );
}

function Room({ interviewId, track }: InterviewRoomProps) {
  const router = useRouter();
  const { interviewer, label } = TRACKS[track];

  const [phase, setPhaseState] = useState<Phase>({ kind: "lobby" });
  const phaseRef = useRef<Phase>(phase);
  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const [transcript, setTranscript] = useState<LiveEntry[]>([]);
  const transcriptRef = useRef<LiveEntry[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  const secondsSinceStart = useCallback(() => {
    if (startedAtRef.current === null) return 0;
    return Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
  }, []);

  const buildPayload = useCallback(
    (status: FinishInterviewInput["status"]): FinishInterviewInput => ({
      status,
      durationSeconds: Math.min(secondsSinceStart(), 7200),
      transcript: transcriptRef.current.map(({ role, text, at }) => ({ role, text, at })),
    }),
    [secondsSinceStart],
  );

  const saveInterview = useCallback(
    async (status: FinishInterviewInput["status"]) => {
      setPhase({ kind: "saving" });
      try {
        const response = await fetch(`/api/interviews/${interviewId}/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(status)),
        });
        // 409: already closed (e.g. by a second tab); the result page shows the saved state.
        if (!response.ok && response.status !== 409) {
          const body = (await response.json().catch(() => null)) as ApiError | null;
          setPhase({
            kind: "save-error",
            message: body?.error ?? "Das Transkript konnte nicht gespeichert werden.",
          });
          return;
        }
        router.replace(`/interviews/${interviewId}/feedback`);
      } catch {
        setPhase({
          kind: "save-error",
          message: "Keine Verbindung zum Server. Dein Transkript ist noch hier, versuche es erneut.",
        });
      }
    },
    [buildPayload, interviewId, router, setPhase],
  );

  const handleMessage = useCallback(
    ({ message, role, response_id }: MessagePayload) => {
      const text = message.trim();
      if (!text) return;
      const entry: LiveEntry = {
        role: role === "agent" ? "interviewer" : "candidate",
        text: text.slice(0, 5000),
        at: Math.min(secondsSinceStart(), 7200),
        responseId: response_id,
      };
      const previous = transcriptRef.current;
      const last = previous.at(-1);
      const replacesLast =
        entry.role === "interviewer" &&
        last?.role === "interviewer" &&
        entry.responseId !== undefined &&
        last.responseId === entry.responseId;
      const next = replacesLast ? [...previous.slice(0, -1), { ...entry, at: last.at }] : [...previous, entry];
      transcriptRef.current = next;
      setTranscript(next);
    },
    [secondsSinceStart],
  );

  const handleDisconnect = useCallback(
    (details: DisconnectionDetails) => {
      if (phaseRef.current.kind !== "live") return;
      if (details.reason === "agent") {
        // The interviewer said goodbye and hung up.
        void saveInterview("finished");
      } else if (details.reason === "error") {
        setPhase({
          kind: "interrupted",
          message: "Die Verbindung zum Interviewer wurde unterbrochen.",
        });
      }
    },
    [saveInterview, setPhase],
  );

  const conversation = useConversation({
    onConnect: () => {
      startedAtRef.current = Date.now();
      setPhase({ kind: "live" });
    },
    onDisconnect: handleDisconnect,
    onMessage: handleMessage,
    onError: () => {
      if (phaseRef.current.kind === "preparing") {
        setPhase({
          kind: "lobby",
          error: "Die Verbindung zum Interviewer konnte nicht hergestellt werden. Bitte versuche es erneut.",
        });
      }
    },
  });
  const { startSession, endSession, isSpeaking, isMuted, setMuted, getInputVolume, getOutputVolume } =
    conversation;

  async function startInterview() {
    setPhase({ kind: "preparing", step: "mic" });
    const mic = await checkMicrophone();
    if (!mic.ok) {
      setPhase({ kind: "lobby", error: mic.message });
      return;
    }

    setPhase({ kind: "preparing", step: "connect" });
    try {
      const response = await fetch(`/api/elevenlabs/signed-url?interviewId=${interviewId}`, {
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as SignedUrlResponse | ApiError | null;
      if (!response.ok || !body || !("signedUrl" in body)) {
        setPhase({
          kind: "lobby",
          error: body && "error" in body ? body.error : "Der Interviewer ist gerade nicht erreichbar.",
        });
        return;
      }
      startSession({ signedUrl: body.signedUrl, connectionType: "websocket" });
    } catch {
      setPhase({
        kind: "lobby",
        error: "Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.",
      });
    }
  }

  const stopCamera = useCallback(() => {
    setCameraStream((stream) => {
      stream?.getTracks().forEach((t) => t.stop());
      return null;
    });
  }, []);

  const finishInterview = useCallback(() => {
    // Set the phase first so the resulting onDisconnect is ignored.
    void saveInterview("finished");
    endSession();
    stopCamera();
  }, [endSession, saveInterview, stopCamera]);

  async function toggleCamera() {
    if (cameraStream) {
      stopCamera();
      return;
    }
    const result = await openCamera();
    if (result.ok) setCameraStream(result.stream);
    else toast.error(result.message);
  }

  const isLive = phase.kind === "live";

  // Call timer and hard time limit.
  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      const seconds = secondsSinceStart();
      setElapsed(seconds);
      if (seconds >= MAX_DURATION_SECONDS) {
        toast.info("Die maximale Interviewdauer ist erreicht. Das Interview wird beendet.");
        finishInterview();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isLive, secondsSinceStart, finishInterview]);

  // Warn before leaving, and save what we have if the tab is closed anyway.
  useEffect(() => {
    if (!isLive) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const onPageHide = () => {
      const blob = new Blob([JSON.stringify(buildPayload("aborted"))], { type: "text/plain" });
      navigator.sendBeacon(`/api/interviews/${interviewId}/finish`, blob);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [isLive, buildPayload, interviewId]);

  // Release the camera when leaving the room.
  useEffect(() => () => cameraStream?.getTracks().forEach((t) => t.stop()), [cameraStream]);

  // Keep the newest message in view without scrolling the whole page.
  useEffect(() => {
    const panel = transcriptScrollRef.current;
    if (panel) panel.scrollTo({ top: panel.scrollHeight, behavior: "smooth" });
  }, [transcript, showTranscript]);

  if (phase.kind === "lobby" || phase.kind === "preparing") {
    return (
      <Lobby
        trackLabel={label}
        interviewerName={interviewer.name}
        interviewerRole={interviewer.role}
        error={phase.kind === "lobby" ? phase.error : undefined}
        preparingStep={phase.kind === "preparing" ? phase.step : undefined}
        onStart={startInterview}
      />
    );
  }

  if (phase.kind === "interrupted" || phase.kind === "save-error") {
    const hasAnswers = transcript.some((e) => e.role === "candidate");
    return (
      <StatusCard
        title={phase.kind === "interrupted" ? "Verbindung unterbrochen" : "Speichern fehlgeschlagen"}
        message={phase.message}
      >
        <Button size="lg" className="h-10" onClick={() => saveInterview(hasAnswers ? "finished" : "aborted")}>
          {phase.kind === "interrupted" ? "Interview beenden und speichern" : "Erneut speichern"}
        </Button>
      </StatusCard>
    );
  }

  if (phase.kind === "saving") {
    return (
      <StatusCard title="Interview wird gespeichert" message="Einen Moment, dein Transkript wird gesichert …">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </StatusCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex size-2.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
          </span>
          <span className="truncate font-medium">Mock Interview · {label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1" aria-label={isMuted ? "Mikrofon stumm" : "Mikrofon aktiv"}>
            {isMuted ? <MicOffIcon className="size-4 text-destructive" /> : <MicIcon className="size-4" />}
            <span className="hidden sm:inline">{isMuted ? "Stumm" : "Mikrofon aktiv"}</span>
          </span>
          <span className="flex items-center gap-1 font-mono tabular-nums" aria-label="Interviewdauer">
            <TimerIcon className="size-4" aria-hidden />
            {formatClock(elapsed)}
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        {/* Stage */}
        <div className="relative">
          <InterviewerTile
            name={interviewer.name}
            role={interviewer.role}
            isSpeaking={isSpeaking}
            active={isLive}
            getOutputVolume={getOutputVolume}
            className={cn(
              "lg:h-[min(60dvh,32rem)] lg:min-h-80",
              showTranscript ? "h-56" : "h-[min(60dvh,32rem)] min-h-80",
            )}
          />
          <SelfTile
            cameraStream={cameraStream}
            isMuted={isMuted}
            active={isLive}
            getInputVolume={getInputVolume}
            className="absolute top-3 right-3 h-28 w-20 sm:h-32 sm:w-44"
          />
          {isMuted && (
            <div className="absolute inset-x-0 bottom-16 flex justify-center">
              <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white">
                <VolumeXIcon className="size-3.5" aria-hidden />
                Du bist stummgeschaltet. Der Interviewer hört dich nicht.
              </span>
            </div>
          )}
        </div>

        {/* Live transcript: side panel on large screens, toggle on small ones */}
        <aside
          className={cn(
            "flex-col rounded-2xl border bg-background lg:flex lg:h-[min(60dvh,32rem)] lg:min-h-80",
            showTranscript ? "flex max-h-64" : "hidden",
          )}
          aria-label="Live-Transkript"
        >
          <div className="border-b px-4 py-2.5 text-sm font-medium">Live-Transkript</div>
          <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto p-4">
            {transcript.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Das Gespräch erscheint hier, sobald gesprochen wird.
              </p>
            ) : (
              <TranscriptList entries={transcript} interviewerName={interviewer.name} />
            )}
          </div>
        </aside>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <Button
          variant={isMuted ? "destructive" : "outline"}
          size="icon-lg"
          className="size-12 rounded-full"
          onClick={() => setMuted(!isMuted)}
          aria-label={isMuted ? "Stummschaltung aufheben" : "Stummschalten"}
          aria-pressed={isMuted}
        >
          {isMuted ? <MicOffIcon /> : <MicIcon />}
        </Button>
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
          aria-label={showTranscript ? "Transkript ausblenden" : "Transkript anzeigen"}
          aria-pressed={showTranscript}
        >
          <MessageSquareTextIcon />
        </Button>
        <Button
          size="lg"
          className="h-12 rounded-full bg-red-600 px-5 text-white hover:bg-red-700"
          onClick={finishInterview}
        >
          <PhoneOffIcon aria-hidden />
          Interview beenden
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Die Eigenansicht bleibt in deinem Browser und wird nicht übertragen.
      </p>
    </div>
  );
}

type LobbyProps = {
  trackLabel: string;
  interviewerName: string;
  interviewerRole: string;
  error?: string;
  preparingStep?: "mic" | "connect";
  onStart: () => void;
};

function Lobby({ trackLabel, interviewerName, interviewerRole, error, preparingStep, onStart }: LobbyProps) {
  const preparing = preparingStep !== undefined;
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
          <TimerIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          Plane etwa 15 bis 20 Minuten ein. Das Gespräch läuft komplett per Sprache.
        </li>
        <li className="flex gap-3">
          <HeadphonesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          Such dir einen ruhigen Ort. Mit Kopfhörern klingt es besser und es gibt kein Echo.
        </li>
        <li className="flex gap-3">
          <MicIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          Dein Browser fragt gleich nach dem Mikrofon. Bitte erlaube den Zugriff.
        </li>
      </ul>

      {error && (
        <div
          className="flex gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      <Button size="lg" className="h-11" onClick={onStart} disabled={preparing}>
        {preparing && <Loader2Icon className="animate-spin" aria-hidden />}
        {preparingStep === "mic"
          ? "Mikrofon wird geprüft …"
          : preparingStep === "connect"
            ? "Verbindung wird aufgebaut …"
            : error
              ? "Erneut versuchen"
              : "Interview beginnen"}
      </Button>
    </div>
  );
}

function StatusCard({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border px-6 py-10 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground" role="status">
        {message}
      </p>
      {children}
    </div>
  );
}
