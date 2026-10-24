import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { InterviewRoom } from "@/components/interview/interview-room";
import { getInterview } from "@/lib/interview/queries";
import { getScript } from "@/lib/interview/script";
import { transcriptSchema } from "@/lib/schemas/interview";

export const metadata: Metadata = { title: "Interview" };

export default function InterviewPage({ params }: PageProps<"/interviews/[id]">) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <InterviewLoader params={params} />
    </Suspense>
  );
}

async function InterviewLoader({ params }: Pick<PageProps<"/interviews/[id]">, "params">) {
  const { id } = await params;
  const interview = await getInterview(id);
  if (!interview) notFound();
  if (interview.status !== "running") redirect(`/interviews/${id}/feedback`);

  const script = getScript(interview.track);
  if (!script) notFound();
  const transcript = transcriptSchema.safeParse(interview.transcript);

  return (
    <InterviewRoom
      interviewId={interview.id}
      track={interview.track}
      script={script}
      initialTranscript={transcript.success ? transcript.data : []}
    />
  );
}

function RoomSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-lg animate-pulse flex-col items-center gap-4" role="status" aria-label="Wird geladen">
      <div className="size-24 rounded-full bg-muted" />
      <div className="h-6 w-56 rounded-md bg-muted" />
      <div className="h-32 w-full rounded-xl bg-muted" />
      <div className="h-11 w-full rounded-lg bg-muted" />
    </div>
  );
}
