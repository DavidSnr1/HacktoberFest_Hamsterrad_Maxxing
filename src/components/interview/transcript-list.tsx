import type { TranscriptEntry } from "@/lib/schemas/interview";
import { cn } from "@/lib/utils";

export function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

type TranscriptListProps = {
  entries: TranscriptEntry[];
  interviewerName: string;
  className?: string;
};

/** Chat-style transcript, used live in the room and on the result page. */
export function TranscriptList({ entries, interviewerName, className }: TranscriptListProps) {
  return (
    <ol className={cn("flex flex-col gap-3", className)}>
      {entries.map((entry, index) => {
        const isCandidate = entry.role === "candidate";
        return (
          <li
            key={index}
            className={cn("flex flex-col gap-1", isCandidate ? "items-end" : "items-start")}
          >
            <span className="text-xs text-muted-foreground">
              {isCandidate ? "Du" : interviewerName} · {formatClock(entry.at)}
            </span>
            <p
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                isCandidate ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted",
              )}
            >
              {entry.text}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
