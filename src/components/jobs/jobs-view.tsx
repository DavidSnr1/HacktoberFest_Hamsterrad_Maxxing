"use client";

import { BriefcaseIcon, SearchXIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
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

  function runSearch(form: SearchForm) {
    setView("search");
    setSelectedId(null);
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

  return (
    <div className="space-y-6">
      <JobSearchForm
        loading={search.status === "loading"}
        onSearch={runSearch}
        initial={initialForm ?? undefined}
        suggestions={preferences}
      />

      <div className="flex gap-2" role="group" aria-label="Ansicht">
        <Button
          type="button"
          aria-pressed={view === "search"}
          variant={view === "search" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setView("search")}
        >
          Suchergebnisse{search.status === "done" && ` (${results.length})`}
        </Button>
        <Button
          type="button"
          aria-pressed={view === "saved"}
          variant={view === "saved" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setView("saved")}
        >
          Gemerkt{saved && ` (${saved.length})`}
        </Button>
      </div>

      {savedError && (
        <p className="text-sm text-destructive" role="alert">
          {savedError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-label="Stellenliste" className={cn("space-y-3", selected && "hidden lg:block")}>
          {view === "search" && search.status === "done" && (
            <>
              <SourceStatus sources={search.result.sources} cached={search.result.cached} />
              {preferences && results.length > 1 && (
                <p className="text-xs text-muted-foreground">Sortiert nach Passung zu deinem Profil.</p>
              )}
            </>
          )}
          <ListState view={view} search={search} saved={saved} count={list.length} />
          {list.map((posting) => (
            <JobCard
              key={posting.id}
              posting={posting}
              selected={posting.id === selectedId}
              fit={fits.get(posting.id) ?? null}
              saved={savedIds.has(posting.id)}
              savePending={pendingSave.has(posting.id)}
              onSelect={() => setSelectedId(posting.id)}
              onToggleSave={() => toggleSave(posting)}
            />
          ))}
        </section>

        <section aria-label="Stellendetails" className={cn(!selected && "hidden lg:block")}>
          {selected ? (
            <div className="lg:sticky lg:top-4">
              <JobDetail
                posting={selected}
                earliestStart={preferences?.earliestStart ?? null}
                saved={savedIds.has(selected.id)}
                savePending={pendingSave.has(selected.id)}
                onToggleSave={() => toggleSave(selected)}
                onClose={() => setSelectedId(null)}
              />
            </div>
          ) : (
            list.length > 0 && (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Wähle eine Stelle aus, um die Details zu sehen.
              </p>
            )
          )}
        </section>
      </div>
    </div>
  );
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
        <div className="space-y-3" aria-live="polite" aria-busy="true">
          <p className="text-sm text-muted-foreground">Wir fragen die Jobportale ab. Das kann ein paar Sekunden dauern …</p>
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          ))}
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
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground [&_svg]:size-8">
      {icon}
      <p className="max-w-sm">{text}</p>
    </div>
  );
}
