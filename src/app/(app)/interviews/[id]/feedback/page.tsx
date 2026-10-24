import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeftIcon, CircleAlertIcon } from "lucide-react";
import { FeedbackPending } from "@/components/interview/feedback-pending";
import { FeedbackView } from "@/components/interview/feedback-view";
import { RetryFeedbackButton } from "@/components/interview/retry-feedback-button";
import { TranscriptList } from "@/components/interview/transcript-list";
import { getInterview, getInterviewFeedback } from "@/lib/interview/queries";
import { getTranscriptStats, MIN_CANDIDATE_WORDS_FOR_FEEDBACK } from "@/lib/interview/transcript-stats";
import { TRACKS } from "@/lib/interview/tracks";
import { storedScoresSchema } from "@/lib/schemas/feedback";
import { transcriptSchema } from "@/lib/schemas/interview";

export const metadata: Metadata = { title: "Interview-Auswertung" };

/** How long after finishing a missing feedback counts as "still being generated". */
const PENDING_WINDOW_MS = 6 * 60 * 1000;

/** Request-time check; this server component renders per request. */
function isBefore(timestamp: number) {
  return Date.now() < timestamp;
}

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

export default function FeedbackPage({ params }: PageProps<"/interviews/[id]/feedback">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        href="/interviews"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        Zurück zur Übersicht
      </Link>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <FeedbackContent params={params} />
      </Suspense>
    </div>
  );
}

async function FeedbackContent({ params }: Pick<PageProps<"/interviews/[id]/feedback">, "params">) {
  const { id } = await params;
  const [interview, feedback] = await Promise.all([getInterview(id), getInterviewFeedback(id)]);
  if (!interview) notFound();
  if (interview.status === "running") redirect(`/interviews/${id}`);

  const track = TRACKS[interview.track];
  const transcript = transcriptSchema.safeParse(interview.transcript);
  const scores = feedback ? storedScoresSchema.safeParse(feedback.scores) : null;
  const tooShort =
    transcript.success && getTranscriptStats(transcript.data).candidateWords < MIN_CANDIDATE_WORDS_FOR_FEEDBACK;
  const minutes = interview.duration_seconds ? Math.max(1, Math.round(interview.duration_seconds / 60)) : null;
  const pendingUntil = interview.finished_at ? new Date(interview.finished_at).getTime() + PENDING_WINDOW_MS : 0;
  const isPending = !feedback && !tooShort && isBefore(pendingUntil);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mock Interview · {track.label}</h1>
        <p className="text-sm text-muted-foreground">
          {dateFormat.format(new Date(interview.started_at))}
          {minutes && ` · ${minutes} Min.`} · mit {track.interviewer.name}
        </p>
      </header>

      {interview.status === "aborted" ? (
        <Notice>
          Dieses Interview wurde abgebrochen, bevor du geantwortet hast. Dafür gibt es keine
          Auswertung. Starte einfach ein neues Interview.
        </Notice>
      ) : feedback && scores?.success ? (
        <FeedbackView
          scores={scores.data}
          strengths={feedback.strengths}
          improvements={feedback.improvements}
          exercise={feedback.exercise}
          summary={feedback.summary}
        />
      ) : feedback ? (
        <Notice>Die gespeicherte Auswertung konnte nicht gelesen werden.</Notice>
      ) : isPending ? (
        <FeedbackPending until={pendingUntil} />
      ) : tooShort ? (
        <Notice>
          Das Gespräch war zu kurz für eine aussagekräftige Auswertung. Nimm dir beim nächsten
          Mal etwas mehr Zeit und beantworte mehrere Fragen ausführlich.
        </Notice>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex gap-3">
            <CircleAlertIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium">Auswertung fehlt noch</p>
              <p className="text-muted-foreground">
                Die Auswertung konnte nicht erstellt werden, zum Beispiel weil der KI-Dienst
                überlastet war. Dein Transkript ist gespeichert.
              </p>
            </div>
          </div>
          <RetryFeedbackButton interviewId={interview.id} />
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Transkript</h2>
        {!transcript.success ? (
          <p className="text-sm text-destructive" role="alert">
            Das Transkript konnte nicht gelesen werden.
          </p>
        ) : transcript.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Es wurde nichts gesprochen.</p>
        ) : (
          <TranscriptList
            entries={transcript.data}
            interviewerName={track.interviewer.name}
            className="rounded-xl border p-4"
          />
        )}
      </section>
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{children}</div>;
}
