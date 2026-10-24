"use client";

import { CalendarClockIcon, UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { personalApplyWindow } from "@/lib/jobs/fit";
import type { JobOutlook as JobOutlookType } from "@/lib/schemas/job-posting";
import { fetchOutlook } from "./jobs-api";
import { applyWindowLabel, COMPETITION_LABELS, formatMonthsBefore } from "./labels";

type Loaded = { id: string; outlook: JobOutlookType | null };

// Application timing and competition for one posting, plus the window for the user's own start date.
export function JobOutlook({ jobId, earliestStart }: { jobId: string; earliestStart: string | null }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOutlook(jobId)
      .then((outlook) => {
        if (!cancelled) setLoaded({ id: jobId, outlook });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id: jobId, outlook: null });
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (loaded?.id !== jobId) {
    return (
      <div className="h-16 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-busy="true">
        <span className="sr-only">Einschätzung wird geladen …</span>
      </div>
    );
  }

  const outlook = loaded.outlook;
  const timing = outlook ? formatMonthsBefore(outlook.applyMonthsBefore) : null;
  const competition = outlook?.competition
    ? `${COMPETITION_LABELS[outlook.competition]}${outlook.applicantCount !== null ? ` (${outlook.applicantCount} Bewerbungen)` : ""}`
    : null;
  const personal = outlook ? personalApplyWindow(earliestStart, outlook.applyMonthsBefore, new Date()) : null;
  if (!outlook || (!timing && !competition && !outlook.hint)) return null;

  return (
    <section aria-label="Bewerbungszeitraum und Andrang" className="space-y-2 rounded-lg border p-3 text-sm">
      {timing && (
        <p className="flex items-start gap-2">
          <CalendarClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="text-muted-foreground">Bewerben: </span>
            {timing}
            {outlook.applicationPeriod && ` · ${outlook.applicationPeriod}`}
          </span>
        </p>
      )}
      {competition && (
        <p className="flex items-start gap-2">
          <UsersIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="text-muted-foreground">Andrang: </span>
            {competition}
          </span>
        </p>
      )}
      {personal && <p className="font-medium">{applyWindowLabel(personal)}</p>}
      {outlook.hint && <p className="text-muted-foreground">{outlook.hint}</p>}
    </section>
  );
}
