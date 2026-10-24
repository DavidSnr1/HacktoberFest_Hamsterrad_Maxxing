import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeftIcon, SparklesIcon } from "lucide-react";
import { TranscriptList } from "@/components/interview/transcript-list";
import { getInterview } from "@/lib/interview/queries";
import { TRACKS } from "@/lib/interview/tracks";
import { transcriptSchema } from "@/lib/schemas/interview";

export const metadata: Metadata = { title: "Interview-Auswertung" };

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
  const interview = await getInterview(id);
  if (!interview) notFound();
  if (interview.status === "running") redirect(`/interviews/${id}`);

  const track = TRACKS[interview.track];
  const transcript = transcriptSchema.safeParse(interview.transcript);
  const minutes = interview.duration_seconds ? Math.max(1, Math.round(interview.duration_seconds / 60)) : null;

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
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Dieses Interview wurde abgebrochen, bevor du geantwortet hast. Dafür gibt es keine
          Auswertung. Starte einfach ein neues Interview.
        </div>
      ) : (
        <div className="flex gap-3 rounded-xl border p-4">
          <SparklesIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium">Auswertung folgt</p>
            <p className="text-muted-foreground">
              Bald bekommst du hier eine Bewertung nach Raster, deine Stärken und konkrete
              Verbesserungstipps. Dein Transkript ist bereits gespeichert.
            </p>
          </div>
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
