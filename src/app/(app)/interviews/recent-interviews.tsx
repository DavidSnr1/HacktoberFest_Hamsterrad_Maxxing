import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
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
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Noch keine Interviews. Starte dein erstes oben.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-xl border">
      {interviews.map((interview) => (
        <li key={interview.id}>
          <Link
            href={`/interviews/${interview.id}/feedback`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{TRACKS[interview.track].label}</span>
              <span className="text-sm text-muted-foreground">
                {dateFormat.format(new Date(interview.started_at))}
                {formatDuration(interview.duration_seconds) &&
                  ` · ${formatDuration(interview.duration_seconds)}`}
              </span>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                interview.status === "finished"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {STATUS_LABELS[interview.status]}
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
