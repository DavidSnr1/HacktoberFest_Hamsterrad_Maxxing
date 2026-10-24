import { TriangleAlertIcon } from "lucide-react";

import type { SourceStatus as SourceStatusType } from "@/lib/schemas/job-posting";

export function SourceStatus({ sources, cached }: { sources: SourceStatusType[]; cached: boolean }) {
  const failed = sources.filter((source) => !source.ok);
  const answered = sources.filter((source) => source.ok).map((source) => source.label);

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {answered.length > 0 && (
        <p>
          Quellen: {answered.join(", ")}
          {cached && " · aus dem Zwischenspeicher"}
        </p>
      )}
      {failed.length > 0 && (
        <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
          <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            Nicht verfügbar: {failed.map((source) => `${source.label} (${source.error ?? "Fehler"})`).join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}
