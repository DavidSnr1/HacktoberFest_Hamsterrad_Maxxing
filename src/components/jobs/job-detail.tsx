"use client";

import { ExternalLinkIcon, FileTextIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isDemoSource, type JobPosting } from "@/lib/schemas/job-posting";
import { cn } from "@/lib/utils";
import { CompanyMark } from "./company-mark";
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
};

type LoadedDetail = { id: string; posting: JobPosting | null };

// Hand-over to the resume feature (TEAM-KONTEXT 5.2). `track` picks the matching resume right away;
// the role comes from the job title via `getJobPostingText(jobId)`.
function resumeHref(posting: JobPosting): string {
  const params = new URLSearchParams({ jobId: posting.id });
  if (posting.track) params.set("track", posting.track);
  return `/resume?${params.toString()}`;
}

// Detail pane (desktop) or sheet (mobile): header, scrollable body and a fixed action bar.
export function JobDetail({ posting, earliestStart, saved, savePending, onToggleSave }: Props) {
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
    <>
      <header className="space-y-4 border-b p-5 pr-14 sm:p-6 sm:pr-14">
        <div className="flex items-start gap-3">
          <CompanyMark company={posting.company} className="size-12 text-base" />
          <div className="min-w-0 space-y-1">
            <h2 className="font-heading text-lg leading-snug font-semibold">{posting.title}</h2>
            <p className="text-muted-foreground">
              {[posting.company, posting.location].filter(Boolean).join(" · ") || "Keine Angaben zu Firma und Ort"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {posting.employmentType && <Badge>{EMPLOYMENT_TYPE_LABELS[posting.employmentType]}</Badge>}
          {posting.track && <Badge variant="secondary">{TRACK_LABELS[posting.track]}</Badge>}
          <Badge variant="outline">{SOURCE_LABELS[posting.source] ?? posting.source}</Badge>
          {date && <span className="ml-1 text-xs text-muted-foreground">veröffentlicht am {date}</span>}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
        <JobFacts insights={full.insights} />
        {/* Loaded after the details so the detail page is fetched only once. */}
        {!loading && <JobOutlook jobId={posting.id} earliestStart={earliestStart} />}

        <section aria-labelledby="job-description-heading" className="space-y-2">
          <h3 id="job-description-heading" className="font-semibold">
            Beschreibung
          </h3>
          {loading && !description && (
            <div className="space-y-2" aria-live="polite" aria-busy="true">
              <span className="sr-only">Beschreibung wird geladen …</span>
              {[100, 92, 96, 70].map((width) => (
                <div
                  key={width}
                  className="h-3.5 animate-pulse rounded bg-muted motion-reduce:animate-none"
                  style={{ width: `${width}%` }}
                />
              ))}
            </div>
          )}
          {description ? (
            <div className="whitespace-pre-line leading-relaxed text-foreground/90">{description}</div>
          ) : (
            !loading && (
              <p className="text-muted-foreground">
                Für diese Stelle liegt keine Beschreibung vor. Den vollständigen Text findest du in der Originalanzeige.
              </p>
            )
          )}
          {loading && description && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Vollständige Beschreibung wird geladen …
            </p>
          )}
        </section>
      </div>

      <footer className="flex flex-col gap-2 border-t bg-muted/40 p-4 sm:flex-row sm:items-center sm:px-6">
        <Link href={resumeHref(posting)} className={cn(buttonVariants({ size: "lg" }), "sm:flex-1")}>
          <FileTextIcon aria-hidden />
          Lebenslauf für diese Stelle anpassen
        </Link>
        <a
          href={posting.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <ExternalLinkIcon aria-hidden />
          {demo ? "Auf Indeed suchen" : "Zur Originalanzeige"}
        </a>
        <SaveJobButton saved={saved} pending={savePending} onToggle={onToggleSave} withLabel />
      </footer>
    </>
  );
}
