"use client";

import { ArrowLeftIcon, ExternalLinkIcon, FileTextIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isDemoSource, type JobPosting } from "@/lib/schemas/job-posting";
import { JobFacts } from "./job-facts";
import { JobOutlook } from "./job-outlook";
import { fetchJob } from "./jobs-api";
import { EMPLOYMENT_TYPE_LABELS, formatDate, SOURCE_LABELS, TRACK_LABELS } from "./labels";
import { SaveJobButton } from "./save-job-button";

type Props = {
  posting: JobPosting;
  earliestStart: string | null; // from the user's profile, "YYYY-MM"
  saved: boolean;
  savePending: boolean;
  onToggleSave: () => void;
  onClose: () => void;
};

type LoadedDetail = { id: string; posting: JobPosting | null };

// Hand-over to the resume feature (TEAM-KONTEXT 5.2). `track` picks the matching resume right away;
// the role comes from the job title via `getJobPostingText(jobId)`.
function resumeHref(posting: JobPosting): string {
  const params = new URLSearchParams({ jobId: posting.id });
  if (posting.track) params.set("track", posting.track);
  return `/resume?${params.toString()}`;
}

export function JobDetail({ posting, earliestStart, saved, savePending, onToggleSave, onClose }: Props) {
  const [loaded, setLoaded] = useState<LoadedDetail | null>(null);

  // Search results may only contain a snippet; load the full text when the posting is opened.
  useEffect(() => {
    let cancelled = false;
    fetchJob(posting.id)
      .then((full) => {
        if (!cancelled) setLoaded({ id: posting.id, posting: full });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id: posting.id, posting: null });
      });
    return () => {
      cancelled = true;
    };
  }, [posting.id]);

  const date = formatDate(posting.publishedAt);
  const current = loaded?.id === posting.id ? loaded : null;
  const loading = !current;
  const full = current?.posting ?? posting;
  const description = full.description || posting.description;
  const demo = isDemoSource(posting.source);

  return (
    <Card>
      <CardHeader className="gap-3">
        <Button type="button" variant="ghost" size="sm" className="w-fit lg:hidden" onClick={onClose}>
          <ArrowLeftIcon aria-hidden />
          Zurück zur Liste
        </Button>
        <CardTitle className="text-lg leading-snug">{posting.title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {[posting.company, posting.location].filter(Boolean).join(" · ")}
          {date && ` · veröffentlicht am ${date}`}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {posting.employmentType && <Badge>{EMPLOYMENT_TYPE_LABELS[posting.employmentType]}</Badge>}
          {posting.track && <Badge variant="secondary">{TRACK_LABELS[posting.track]}</Badge>}
          <Badge variant="outline">{SOURCE_LABELS[posting.source] ?? posting.source}</Badge>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link href={resumeHref(posting)} className={buttonVariants()}>
            <FileTextIcon aria-hidden />
            Lebenslauf für diese Stelle anpassen
          </Link>
          <a
            href={posting.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLinkIcon aria-hidden />
            {demo ? "Auf Indeed suchen" : "Zur Originalanzeige"}
          </a>
          <SaveJobButton saved={saved} pending={savePending} onToggle={onToggleSave} withLabel />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {demo && (
          <p className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Beispielanzeige: Indeed blockiert automatische Abfragen, deshalb ist diese Stelle erfunden. Echte
              Treffer findest du über „Auf Indeed suchen“.
            </span>
          </p>
        )}
        <JobFacts insights={full.insights} />
        {/* Loaded after the details so the detail page is fetched only once. */}
        {!loading && <JobOutlook jobId={posting.id} earliestStart={earliestStart} />}
        {loading && !description && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Beschreibung wird geladen …
          </p>
        )}
        {description ? (
          <div className="whitespace-pre-line text-sm leading-relaxed">{description}</div>
        ) : (
          !loading && (
            <p className="text-sm text-muted-foreground">
              Für diese Stelle liegt keine Beschreibung vor. Den vollständigen Text findest du in der Originalanzeige.
            </p>
          )
        )}
        {loading && description && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Vollständige Beschreibung wird geladen …
          </p>
        )}
      </CardContent>
    </Card>
  );
}
