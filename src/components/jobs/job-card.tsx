"use client";

import { ClockIcon, MapPinIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { JobFit } from "@/lib/jobs/fit";
import type { JobPosting } from "@/lib/schemas/job-posting";
import { cn } from "@/lib/utils";
import { CompanyMark } from "./company-mark";
import { EMPLOYMENT_TYPE_LABELS, fitReasonLabel, formatRelativeDate, SOURCE_LABELS, TRACK_LABELS } from "./labels";
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
  const date = formatRelativeDate(posting.publishedAt);
  return (
    <Card
      className={cn(
        "relative h-full transition-shadow hover:shadow-md hover:ring-foreground/20 has-[[data-card-trigger]:focus-visible]:ring-2 has-[[data-card-trigger]:focus-visible]:ring-ring",
        selected && "ring-2 ring-primary hover:ring-primary",
      )}
    >
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-start gap-3">
          <CompanyMark company={posting.company} />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-medium leading-snug">
              {/* The ::after overlay makes the whole card clickable; the save button sits above it. */}
              <button
                type="button"
                data-card-trigger
                onClick={onSelect}
                aria-haspopup="dialog"
                className="text-left outline-none after:absolute after:inset-0 after:content-['']"
              >
                {posting.title}
              </button>
            </h3>
            <p className="mt-0.5 truncate text-muted-foreground">{posting.company ?? "Firma nicht angegeben"}</p>
          </div>
          <SaveJobButton
            saved={saved}
            pending={savePending}
            onToggle={onToggleSave}
            className="relative z-10 -mt-1 -mr-1"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {posting.location && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{posting.location}</span>
            </span>
          )}
          {date && (
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3.5 shrink-0" aria-hidden />
              {date}
            </span>
          )}
        </div>

        {fit && fit.matches.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-positive">
            <SparklesIcon className="mt-px size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">Passt zu dir: {fit.matches.map(fitReasonLabel).join(" · ")}</span>
          </p>
        )}
        {fit?.warnings.map((warning) => (
          <p key={warning.kind} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{fitReasonLabel(warning)}</span>
          </p>
        ))}

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {posting.employmentType && <Badge>{EMPLOYMENT_TYPE_LABELS[posting.employmentType]}</Badge>}
          {posting.track && <Badge variant="secondary">{TRACK_LABELS[posting.track]}</Badge>}
          <Badge variant="outline">{SOURCE_LABELS[posting.source] ?? posting.source}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
