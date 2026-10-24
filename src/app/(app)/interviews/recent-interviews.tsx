import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { TRACK_COLORS } from "@/components/interview/track-colors";
import { TRACKS } from "@/lib/interview/tracks";
import type { Enums } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<Enums<"interview_status">, string> = {
  running: "Nicht abgeschlossen",
  finished: "Abgeschlossen",
  aborted: "Abgebrochen",
};

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} Min.`;
}

/** The user's last interviews with a link to their transcript. */
export async function RecentInterviews() {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: interviews, error } = await supabase
    .from("interviews")
    .select("id, track, status, started_at, duration_seconds")
    .order("started_at", { ascending: false })
    .limit(10);

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Deine bisherigen Interviews konnten nicht geladen werden.
      </p>
    );
  }
  if (!interviews?.length) {
    return (
      <p className="rounded-lg border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        Noch keine Interviews. Starte dein erstes oben.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Column heads mirror the row layout below; phones show stacked rows instead. */}
      <div
        className="hidden items-center gap-4 border-b bg-muted/60 px-4 py-2 text-xs font-semibold text-muted-foreground sm:flex"
        aria-hidden
      >
        <span className="w-36">Track</span>
        <span className="flex-1">Datum</span>
        <span className="w-16 text-right">Dauer</span>
        <span className="w-40">Status</span>
        <span className="w-4" />
      </div>
      <ul className="divide-y">
        {interviews.map((interview) => {
          const duration = formatDuration(interview.duration_seconds);
          return (
            <li key={interview.id}>
              <Link
                href={`/interviews/${interview.id}/feedback`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-4">
                  <span className={cn("flex items-center gap-2 font-medium sm:w-36", TRACK_COLORS[interview.track])}>
                    <span className="size-2.5 shrink-0 rounded-[2px] bg-(--track)" aria-hidden />
                    {TRACKS[interview.track].label}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums sm:flex-1">
                    {dateFormat.format(new Date(interview.started_at))}
                    {duration && <span className="sm:hidden"> · {duration}</span>}
                  </span>
                  <span className="hidden w-16 text-right text-sm text-muted-foreground tabular-nums sm:block">
                    {duration ?? "–"}
                  </span>
                </div>
                <span className="shrink-0 sm:w-40">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs font-medium",
                      interview.status === "finished"
                        ? "border-positive/25 bg-positive/10 text-positive"
                        : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {STATUS_LABELS[interview.status]}
                  </span>
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
