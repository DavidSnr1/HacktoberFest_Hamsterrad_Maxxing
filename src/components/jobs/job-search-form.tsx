"use client";

import { SearchIcon, UserRoundIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobPreferences } from "@/lib/jobs/profile";
import { EMPLOYMENT_TYPES, JOB_TRACKS } from "@/lib/schemas/job-posting";
import type { SearchForm } from "./jobs-api";
import { EMPLOYMENT_TYPE_LABELS, TRACK_LABELS } from "./labels";

// Same look as <Input>, one step taller to match the search bar.
const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

export const EMPTY_SEARCH_FORM: SearchForm = { q: "", location: "", track: "", type: "" };

type Props = {
  loading: boolean;
  onSearch: (form: SearchForm) => void;
  initial?: SearchForm;
  // Values from the user's profile, offered as one-click alternatives.
  suggestions?: Pick<JobPreferences, "tracks" | "types" | "locations"> | null;
};

export function JobSearchForm({ loading, onSearch, initial = EMPTY_SEARCH_FORM, suggestions }: Props) {
  const [form, setForm] = useState<SearchForm>(initial);

  function update(field: keyof SearchForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(form);
  }

  function applySuggestion(field: keyof SearchForm, value: string) {
    const next = { ...form, [field]: value };
    setForm(next);
    onSearch(next);
  }

  const empty = !form.q.trim() && !form.location.trim() && !form.track && !form.type;
  const groups = suggestions
    ? [
        { field: "track" as const, items: suggestions.tracks.map((track) => ({ value: track, label: TRACK_LABELS[track] })) },
        {
          field: "type" as const,
          items: suggestions.types.map((type) => ({ value: type, label: EMPLOYMENT_TYPE_LABELS[type] })),
        },
        { field: "location" as const, items: suggestions.locations.map((location) => ({ value: location, label: location })) },
      ].filter((group) => group.items.length > 1)
    : [];

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1fr_1fr_auto] lg:items-end">
        <label className="grid gap-1.5 text-sm font-medium">
          Was suchst du?
          <Input
            className="h-9"
            value={form.q}
            onChange={(event) => update("q", event.target.value)}
            placeholder="z. B. Strategy, Data Analyst, Marketing"
            maxLength={120}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Ort
          <Input
            className="h-9"
            value={form.location}
            onChange={(event) => update("location", event.target.value)}
            placeholder="z. B. München"
            maxLength={80}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Bereich
          <select className={selectClassName} value={form.track} onChange={(event) => update("track", event.target.value)}>
            <option value="">Alle Bereiche</option>
            {JOB_TRACKS.map((track) => (
              <option key={track} value={track}>
                {TRACK_LABELS[track]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Art
          <select className={selectClassName} value={form.type} onChange={(event) => update("type", event.target.value)}>
            <option value="">Alle Arten</option>
            {EMPLOYMENT_TYPES.filter((type) => type !== "other").map((type) => (
              <option key={type} value={type}>
                {EMPLOYMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="lg" disabled={loading || empty} className="sm:col-span-2 lg:col-span-1 lg:px-4">
          <SearchIcon aria-hidden />
          {loading ? "Suche läuft …" : "Suchen"}
        </Button>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <UserRoundIcon className="size-4" aria-hidden />
            Aus deinem Profil:
          </span>
          {groups.map((group) => (
            <div key={group.field} className="flex flex-wrap gap-1.5" role="group">
              {group.items.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  size="sm"
                  variant={form[group.field] === item.value ? "secondary" : "outline"}
                  aria-pressed={form[group.field] === item.value}
                  disabled={loading}
                  onClick={() => applySuggestion(group.field, item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
