"use client";

import { SparklesIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { JobFit } from "@/lib/jobs/fit";
import type { JobPosting } from "@/lib/schemas/job-posting";
import { cn } from "@/lib/utils";
import { EMPLOYMENT_TYPE_LABELS, fitReasonLabel, formatDate, SOURCE_LABELS, TRACK_LABELS } from "./labels";
import { SaveJobButton } from "./save-job-button";

type Props = {
  posting: JobPosting;
  selected: boolean;
  fit: JobFit | null;
  saved: boolean;
  savePending: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
};

export function JobCard({ posting, selected, fit, saved, savePending, onSelect, onToggleSave }: Props) {
  const date = formatDate(posting.publishedAt);
  return (
    <Card className={cn("transition-colors", selected && "border-primary")}>
      <CardContent className="flex items-start gap-3">
        <button
          type="button"
          onClick={onSelect}
          aria-current={selected || undefined}
          className="min-w-0 flex-1 text-left outline-none focus-visible:underline"
        >
          <h3 className="font-medium leading-snug">{posting.title}</h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {[posting.company, posting.location].filter(Boolean).join(" · ") || "Keine Angaben zu Firma und Ort"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {posting.employmentType && <Badge>{EMPLOYMENT_TYPE_LABELS[posting.employmentType]}</Badge>}
            {posting.track && <Badge variant="secondary">{TRACK_LABELS[posting.track]}</Badge>}
            <Badge variant="outline">{SOURCE_LABELS[posting.source] ?? posting.source}</Badge>
            {date && <span className="text-xs leading-5 text-muted-foreground">{date}</span>}
          </div>
          {fit && fit.matches.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <SparklesIcon className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>Passt zu dir: {fit.matches.map(fitReasonLabel).join(" · ")}</span>
            </p>
          )}
          {fit?.warnings.map((warning) => (
            <p
              key={warning.kind}
              className="mt-1 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400"
            >
              <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>{fitReasonLabel(warning)}</span>
            </p>
          ))}
        </button>
        <SaveJobButton saved={saved} pending={savePending} onToggle={onToggleSave} />
      </CardContent>
    </Card>
  );
}
