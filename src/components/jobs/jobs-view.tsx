"use client";

import { ArrowDownWideNarrowIcon, BriefcaseIcon, SearchXIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { computeFit, rankByFit, type JobFit } from "@/lib/jobs/fit";
import type { JobPreferences } from "@/lib/jobs/profile";
import type { JobPosting, JobSearchResult } from "@/lib/schemas/job-posting";
import { cn } from "@/lib/utils";
import { JobCard } from "./job-card";
import { JobDetail } from "./job-detail";
import { EMPTY_SEARCH_FORM, JobSearchForm } from "./job-search-form";
import { fetchSavedJobs, searchJobs, setJobSaved, type SearchForm } from "./jobs-api";
import { SourceStatus } from "./source-status";

type View = "search" | "saved";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; result: JobSearchResult };

// Tailwind's `lg` breakpoint: from here the detail pane sits next to the list instead of in a sheet.
const DESKTOP_QUERY = "(min-width: 64rem)";

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

// First search from the profile: first preferred location, track and type; the rest is offered as chips.
function profileSearchForm(preferences: JobPreferences | null): SearchForm | null {
  if (!preferences) return null;
  const form = {
    ...EMPTY_SEARCH_FORM,
    location: preferences.locations[0] ?? "",
    track: preferences.tracks[0] ?? "",
    type: preferences.types[0] ?? "",
  };
  return form.location || form.track || form.type ? form : null;
}

export function JobsView({ preferences }: { preferences: JobPreferences | null }) {
  const [initialForm] = useState(() => profileSearchForm(preferences));
  const [view, setView] = useState<View>("search");
  const [search, setSearch] = useState<SearchState>(initialForm ? { status: "loading" } : { status: "idle" });
  const [saved, setSaved] = useState<JobPosting[] | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Mobile only. Separate from selectedId so the sheet keeps its content while it slides out.
  const [detailOpen, setDetailOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const [pendingSave, setPendingSave] = useState<Set<string>>(new Set());

  // Only the newest search may update the results, so a slow older response cannot overwrite them.
  const latestSearch = useRef(0);
  const startSearch = useCallback((form: SearchForm) => {
    const run = ++latestSearch.current;
    searchJobs(form)
      .then((result) => {
        if (run === latestSearch.current) setSearch({ status: "done", result });
      })
      .catch((error: unknown) => {
        if (run !== latestSearch.current) return;
        setSearch({ status: "error", message: error instanceof Error ? error.message : "Die Suche ist fehlgeschlagen." });
      });
  }, []);

  // Run the profile search once on open (the ref keeps StrictMode from searching twice).
  const autoSearched = useRef(false);
  useEffect(() => {
    if (!initialForm || autoSearched.current) return;
    autoSearched.current = true;
    startSearch(initialForm);
  }, [initialForm, startSearch]);

  useEffect(() => {
    fetchSavedJobs()
      .then(setSaved)
      .catch((error: unknown) => setSavedError(error instanceof Error ? error.message : "Fehler beim Laden."));
  }, []);

  const savedIds = new Set((saved ?? []).map((posting) => posting.id));
  const found = search.status === "done" ? search.result.postings : [];
  const fits = new Map<string, JobFit>(
    preferences ? [...found, ...(saved ?? [])].map((posting) => [posting.id, computeFit(posting, preferences)]) : [],
  );
  const results = preferences ? rankByFit(found, fits) : found;
  const list = view === "search" ? results : (saved ?? []);
  const selected = [...results, ...(saved ?? [])].find((posting) => posting.id === selectedId) ?? null;
  // On desktop the pane is never empty: until the user picks a posting, the first one is open.
  const shown = selected && list.some((posting) => posting.id === selected.id) ? selected : (list[0] ?? null);

  function openDetail(id: string) {
    setSelectedId(id);
    if (!isDesktop) setDetailOpen(true);
  }

  function runSearch(form: SearchForm) {
    setView("search");
    setSelectedId(null);
    setDetailOpen(false);
    setSearch({ status: "loading" });
    startSearch(form);
  }

  async function toggleSave(posting: JobPosting) {
    const nextSaved = !savedIds.has(posting.id);
    setPendingSave((current) => new Set(current).add(posting.id));
    try {
      await setJobSaved(posting.id, nextSaved);
      setSaved((current) =>
        nextSaved ? [posting, ...(current ?? [])] : (current ?? []).filter((item) => item.id !== posting.id),
      );
      setSavedError(null);
    } catch (error) {
      setSavedError(error instanceof Error ? error.message : "Das hat nicht geklappt.");
    } finally {
      setPendingSave((current) => {
        const next = new Set(current);
        next.delete(posting.id);
        return next;
      });
    }
  }

  const done = view === "search" && search.status === "done";

  return (
    <div className="space-y-6">
      <JobSearchForm
        loading={search.status === "loading"}
        onSearch={runSearch}
        initial={initialForm ?? undefined}
        suggestions={preferences}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label="Ansicht">
            <ViewToggle active={view === "search"} onClick={() => setView("search")}>
              Suchergebnisse
              {search.status === "done" && <Count value={results.length} />}
            </ViewToggle>
            <ViewToggle active={view === "saved"} onClick={() => setView("saved")}>
              Gemerkt
              {saved && <Count value={saved.length} />}
            </ViewToggle>
          </div>
          {done && preferences && results.length > 1 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowDownWideNarrowIcon className="size-3.5" aria-hidden />
              Sortiert nach Passung zu deinem Profil
            </p>
          )}
        </div>
        {done && <SourceStatus sources={search.result.sources} cached={search.result.cached} />}
        {savedError && (
          <p className="text-sm text-destructive" role="alert">
            {savedError}
          </p>
        )}
      </div>

      <ListState view={view} search={search} saved={saved} count={list.length} />
      {list.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
          <ul aria-label="Stellenliste" className="space-y-3">
            {list.map((posting) => (
              <li key={posting.id}>
                <JobCard
                  posting={posting}
                  selected={isDesktop ? posting.id === shown?.id : detailOpen && posting.id === selectedId}
                  fit={fits.get(posting.id) ?? null}
                  saved={savedIds.has(posting.id)}
                  savePending={pendingSave.has(posting.id)}
                  onSelect={() => openDetail(posting.id)}
                  onToggleSave={() => toggleSave(posting)}
                />
              </li>
            ))}
          </ul>

          {isDesktop && shown && (
            <section
              aria-label="Stellendetails"
              className="sticky top-20 flex max-h-[calc(100dvh-6.5rem)] flex-col overflow-hidden rounded-xl bg-card text-sm shadow-sm ring-1 ring-foreground/10"
            >
              <JobDetail
                posting={shown}
                earliestStart={preferences?.earliestStart ?? null}
                saved={savedIds.has(shown.id)}
                savePending={pendingSave.has(shown.id)}
                onToggleSave={() => toggleSave(shown)}
              />
            </section>
          )}
        </div>
      )}

      <Sheet open={!isDesktop && detailOpen && selected !== null} onOpenChange={setDetailOpen}>
        <SheetContent aria-label={selected?.title ?? "Stellendetails"}>
          {selected && (
            <JobDetail
              posting={selected}
              earliestStart={preferences?.earliestStart ?? null}
              saved={savedIds.has(selected.id)}
              savePending={pendingSave.has(selected.id)}
              onToggleSave={() => toggleSave(selected)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ViewToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
    >
      {children}
    </button>
  );
}

function Count({ value }: { value: number }) {
  return <span className="rounded-full bg-foreground/8 px-1.5 text-xs tabular-nums">{value}</span>;
}

function ListState({
  view,
  search,
  saved,
  count,
}: {
  view: View;
  search: SearchState;
  saved: JobPosting[] | null;
  count: number;
}) {
  if (view === "saved") {
    if (saved === null) return <p className="text-sm text-muted-foreground">Gemerkte Stellen werden geladen …</p>;
    if (count === 0) {
      return (
        <EmptyState
          icon={<BriefcaseIcon aria-hidden />}
          text="Du hast noch keine Stellen gemerkt. Tippe bei einer Stelle auf das Lesezeichen."
        />
      );
    }
    return null;
  }

  switch (search.status) {
    case "idle":
      return (
        <EmptyState
          icon={<BriefcaseIcon aria-hidden />}
          text="Suche nach Praktika, Werkstudentenjobs und Einstiegsstellen. Wir durchsuchen mehrere Jobportale gleichzeitig."
        />
      );
    case "loading":
      return (
        <div className="space-y-4" aria-live="polite" aria-busy="true">
          <p className="text-sm text-muted-foreground">Wir fragen die Jobportale ab. Das kann ein paar Sekunden dauern …</p>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
            <div className="space-y-3">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="space-y-3 rounded-xl p-4 ring-1 ring-foreground/10">
                  <div className="flex gap-3">
                    <Skeleton className="size-10 rounded-lg" />
                    <div className="flex-1 space-y-2 pt-0.5">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3.5 w-1/2" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-2/5" />
                  <div className="flex gap-1.5 pt-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden space-y-4 rounded-xl p-6 ring-1 ring-foreground/10 lg:block">
              <div className="flex gap-3">
                <Skeleton className="size-12 rounded-lg" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
              {[100, 94, 97, 88, 60].map((width) => (
                <Skeleton key={width} className="h-3.5" style={{ width: `${width}%` }} />
              ))}
            </div>
          </div>
        </div>
      );
    case "error":
      return (
        <p className="text-sm text-destructive" role="alert">
          {search.message}
        </p>
      );
    case "done":
      return count === 0 ? (
        <EmptyState
          icon={<SearchXIcon aria-hidden />}
          text="Keine passenden Stellen gefunden. Versuch es mit einem allgemeineren Begriff oder ohne Filter."
        />
      ) : null;
  }
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground [&_svg]:size-8 [&_svg]:text-muted-foreground/60">
      {icon}
      <p className="max-w-sm">{text}</p>
    </div>
  );
}

function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("animate-pulse rounded bg-muted motion-reduce:animate-none", className)} style={style} />;
}
