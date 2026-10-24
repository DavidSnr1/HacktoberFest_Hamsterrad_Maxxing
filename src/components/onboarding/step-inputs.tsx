"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { PencilIcon, PlusIcon, SendHorizontalIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildStation,
  EMPTY_STATION_DRAFT,
  isBlankDraft,
  MAX_STATIONS,
  splitMonth,
  STATION_FORMS,
  stationFromValue,
  type StationDraft,
  type StationEntry,
} from "@/lib/onboarding/stations";
import {
  DEGREE_OPTIONS,
  EXPERIENCE_TYPE_OPTIONS,
  LANGUAGE_LEVEL_OPTIONS,
  type StationKind,
  type StepInput,
} from "@/lib/onboarding/steps";
import type { EducationValue, LanguageValue } from "@/lib/schemas/candidate-profile";
import { cn } from "@/lib/utils";

/** Answer of a step plus the text shown in the user's chat bubble. */
export type SubmitAnswer = (value: unknown, display: string) => void;

type InputProps<T> = { initial?: T; disabled: boolean; onSubmit: SubmitAnswer };

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

function chipClass(active: boolean) {
  return cn(
    "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50",
    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
  );
}

export function StepInputView({
  input,
  initial,
  disabled,
  onSubmit,
}: {
  input: StepInput;
  initial: unknown;
  disabled: boolean;
  onSubmit: SubmitAnswer;
}) {
  switch (input.kind) {
    case "education":
      return <EducationInput initial={initial as EducationValue | undefined} disabled={disabled} onSubmit={onSubmit} />;
    case "stations":
      return (
        <StationsInput station={input.station} initial={initial as unknown[] | undefined} disabled={disabled} onSubmit={onSubmit} />
      );
    case "text":
      return (
        <TextInput placeholder={input.placeholder} initial={initial as string | undefined} disabled={disabled} onSubmit={onSubmit} />
      );
    case "single":
      return <SingleChoice options={input.options} disabled={disabled} onSubmit={onSubmit} />;
    case "multi":
      return (
        <MultiChoice options={input.options} initial={initial as string[] | undefined} disabled={disabled} onSubmit={onSubmit} />
      );
    case "tags":
      return (
        <TagsInput
          placeholder={input.placeholder}
          suggestions={input.suggestions}
          initial={initial as string[] | undefined}
          disabled={disabled}
          onSubmit={onSubmit}
        />
      );
    case "month":
      return <MonthInput initial={initial as string | undefined} disabled={disabled} onSubmit={onSubmit} />;
    case "languages":
      return <LanguagesInput initial={initial as LanguageValue[] | undefined} disabled={disabled} onSubmit={onSubmit} />;
  }
}

function TextInput({ placeholder, initial, disabled, onSubmit }: InputProps<string> & { placeholder: string }) {
  const [value, setValue] = useState(initial ?? "");
  function submit(event: FormEvent) {
    event.preventDefault();
    const text = value.trim();
    if (text) onSubmit(text, text);
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={100}
        disabled={disabled}
        autoFocus
        className="h-10"
        aria-label="Deine Antwort"
      />
      <Button type="submit" size="icon-lg" className="size-10 shrink-0" disabled={disabled || !value.trim()} aria-label="Senden">
        <SendHorizontalIcon />
      </Button>
    </form>
  );
}

function SingleChoice({ options, disabled, onSubmit }: Omit<InputProps<string>, "initial"> & { options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={chipClass(false)}
          disabled={disabled}
          onClick={() => onSubmit(option.value, option.label)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MultiChoice({ options, initial, disabled, onSubmit }: InputProps<string[]> & { options: { value: string; label: string }[] }) {
  const [selected, setSelected] = useState<string[]>(initial ?? []);
  const toggle = (value: string) =>
    setSelected((current) => (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={chipClass(selected.includes(option.value))}
            aria-pressed={selected.includes(option.value)}
            disabled={disabled}
            onClick={() => toggle(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <Button
        className="h-10 self-end px-4"
        disabled={disabled || selected.length === 0}
        onClick={() =>
          onSubmit(
            selected,
            options.filter((o) => selected.includes(o.value)).map((o) => o.label).join(", "),
          )
        }
      >
        Weiter
      </Button>
    </div>
  );
}

function TagsInput({
  placeholder,
  suggestions,
  initial,
  disabled,
  onSubmit,
}: InputProps<string[]> & { placeholder: string; suggestions: string[] }) {
  const [tags, setTags] = useState<string[]>(initial ?? []);
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return;
    setTags((current) => {
      const lower = new Set(current.map((t) => t.toLowerCase()));
      return [...current, ...parts.filter((p) => !lower.has(p.toLowerCase())).map((p) => p.slice(0, 100))];
    });
    setDraft("");
  };

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && tags.length) {
      setTags((current) => current.slice(0, -1));
    }
  }

  const open = suggestions.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()));
  const all = draft.trim() ? [...tags, draft.trim()] : tags;

  return (
    <div className="flex flex-col gap-3">
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag} className="flex items-center gap-1 rounded-full bg-primary py-1.5 pr-1.5 pl-3 text-sm text-primary-foreground">
              {tag}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-white/20"
                onClick={() => setTags((current) => current.filter((t) => t !== tag))}
                disabled={disabled}
                aria-label={`${tag} entfernen`}
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus
        className="h-10"
        aria-label={placeholder}
      />
      {open.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {open.map((s) => (
            <button key={s} type="button" className={chipClass(false)} disabled={disabled} onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
      <Button className="h-10 self-end px-4" disabled={disabled || all.length === 0} onClick={() => onSubmit(all, all.join(", "))}>
        Weiter
      </Button>
    </div>
  );
}

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function MonthSelect({
  value,
  onChange,
  disabled,
  idPrefix,
  yearsFrom,
  yearCount = 8,
}: {
  value: { month: string; year: string };
  onChange: (value: { month: string; year: string }) => void;
  disabled: boolean;
  idPrefix: string;
  yearsFrom: number;
  yearCount?: number;
}) {
  const years = Array.from({ length: yearCount }, (_, i) => String(yearsFrom + i));
  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        id={`${idPrefix}-month`}
        className={selectClass}
        value={value.month}
        onChange={(e) => onChange({ ...value, month: e.target.value })}
        disabled={disabled}
        aria-label="Monat"
      >
        <option value="">Monat</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={String(i + 1).padStart(2, "0")}>
            {name}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={value.year}
        onChange={(e) => onChange({ ...value, year: e.target.value })}
        disabled={disabled}
        aria-label="Jahr"
      >
        <option value="">Jahr</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

const thisYear = new Date().getFullYear();

function MonthInput({ initial, disabled, onSubmit }: InputProps<string>) {
  const [value, setValue] = useState(splitMonth(initial));
  const complete = value.month && value.year;
  return (
    <div className="flex flex-col gap-3">
      <MonthSelect value={value} onChange={setValue} disabled={disabled} idPrefix="start" yearsFrom={thisYear} />
      <Button
        className="h-10 self-end px-4"
        disabled={disabled || !complete}
        onClick={() => onSubmit(`${value.year}-${value.month}`, `${MONTHS[Number(value.month) - 1]} ${value.year}`)}
      >
        Weiter
      </Button>
    </div>
  );
}

function EducationInput({ initial, disabled, onSubmit }: InputProps<EducationValue>) {
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [degree, setDegree] = useState<string>(initial?.degree ?? "bachelor");
  const [field, setField] = useState(initial?.field ?? "");
  const [semester, setSemester] = useState(initial?.semester ? String(initial.semester) : "");
  const [graduation, setGraduation] = useState(splitMonth(initial?.expectedGraduation));

  const semesterNumber = semester ? Number(semester) : null;
  const semesterValid = semesterNumber === null || (Number.isInteger(semesterNumber) && semesterNumber >= 1 && semesterNumber <= 20);
  const graduationValue = graduation.month && graduation.year ? `${graduation.year}-${graduation.month}` : null;
  const valid = institution.trim() && field.trim() && semesterValid;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const value: EducationValue = {
      institution: institution.trim(),
      degree: degree as EducationValue["degree"],
      field: field.trim(),
      semester: semesterNumber,
      expectedGraduation: graduationValue,
    };
    const degreeLabel = DEGREE_OPTIONS.find((o) => o.value === degree)?.label ?? degree;
    const parts = [`${degreeLabel} ${value.field}`, value.institution];
    if (value.semester) parts.push(`${value.semester}. Semester`);
    if (graduationValue) parts.push(`Abschluss ${MONTHS[Number(graduation.month) - 1]} ${graduation.year}`);
    onSubmit(value, parts.join(", "));
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="edu-institution">Hochschule</Label>
        <Input id="edu-institution" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="z. B. Universität Mannheim" maxLength={200} disabled={disabled} className="h-10" autoFocus />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edu-degree">Abschluss</Label>
        <select id="edu-degree" className={selectClass} value={degree} onChange={(e) => setDegree(e.target.value)} disabled={disabled}>
          {DEGREE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edu-field">Studienfach</Label>
        <Input id="edu-field" value={field} onChange={(e) => setField(e.target.value)} placeholder="z. B. BWL" maxLength={200} disabled={disabled} className="h-10" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edu-semester">Semester (optional)</Label>
        <Input
          id="edu-semester"
          type="number"
          inputMode="numeric"
          min={1}
          max={20}
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          placeholder="z. B. 3"
          disabled={disabled}
          aria-invalid={!semesterValid}
          className="h-10"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="grad-month">Abschluss voraussichtlich (optional)</Label>
        <MonthSelect value={graduation} onChange={setGraduation} disabled={disabled} idPrefix="grad" yearsFrom={thisYear - 4} />
      </div>
      <Button type="submit" className="h-10 px-4 sm:col-span-2 sm:justify-self-end" disabled={disabled || !valid}>
        Weiter
      </Button>
    </form>
  );
}

const LANGUAGE_SUGGESTIONS = ["Deutsch", "Englisch", "Französisch", "Spanisch", "Italienisch", "Chinesisch"];

function LanguagesInput({ initial, disabled, onSubmit }: InputProps<LanguageValue[]>) {
  const [rows, setRows] = useState<{ language: string; level: string }[]>(
    initial?.length ? initial : [{ language: "Deutsch", level: "native" }, { language: "Englisch", level: "" }],
  );
  const update = (index: number, patch: Partial<{ language: string; level: string }>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const filled = rows.filter((r) => r.language.trim() && r.level);
  const incomplete = rows.some((r) => (r.language.trim() && !r.level) || (!r.language.trim() && r.level));

  function submit() {
    const value = filled.map((r) => ({ language: r.language.trim(), level: r.level as LanguageValue["level"] }));
    const display = value
      .map((v) => `${v.language} (${LANGUAGE_LEVEL_OPTIONS.find((o) => o.value === v.level)?.label ?? v.level})`)
      .join(", ");
    onSubmit(value, display);
  }

  return (
    <div className="flex flex-col gap-3">
      <datalist id="language-suggestions">
        {LANGUAGE_SUGGESTIONS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_8.5rem_auto] gap-2">
          <Input
            value={row.language}
            onChange={(e) => update(index, { language: e.target.value })}
            list="language-suggestions"
            placeholder="Sprache"
            maxLength={60}
            disabled={disabled}
            className="h-10"
            aria-label={`Sprache ${index + 1}`}
          />
          <select
            className={selectClass}
            value={row.level}
            onChange={(e) => update(index, { level: e.target.value })}
            disabled={disabled}
            aria-label={`Niveau ${index + 1}`}
          >
            <option value="">Niveau</option>
            {LANGUAGE_LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="icon-lg"
            className="size-10"
            onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
            disabled={disabled || rows.length === 1}
            aria-label={`Sprache ${index + 1} entfernen`}
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setRows((current) => [...current, { language: "", level: "" }])} disabled={disabled || rows.length >= 10}>
          <PlusIcon />
          Sprache hinzufügen
        </Button>
        <Button className="h-10 px-4" onClick={submit} disabled={disabled || filled.length === 0 || incomplete}>
          Weiter
        </Button>
      </div>
      {incomplete && <p className="text-xs text-muted-foreground">Bitte wähle für jede Sprache ein Niveau.</p>}
    </div>
  );
}

/** Stations reach back about twelve years and one year ahead (e.g. an internship that is already signed). */
const STATION_YEARS_FROM = thisYear - 12;
const STATION_YEAR_COUNT = 14;

/**
 * List of stations (experience, projects or volunteering). The form holds one
 * entry at a time; "Weiter" also takes over a filled-in form, so a single
 * station needs no extra click.
 */
function StationsInput({ station, initial, disabled, onSubmit }: InputProps<unknown[]> & { station: StationKind }) {
  const form = STATION_FORMS[station];
  const [entries, setEntries] = useState<StationEntry[]>(() =>
    (initial ?? []).flatMap((value) => stationFromValue(station, value) ?? []),
  );
  const [draft, setDraft] = useState<StationDraft>(EMPTY_STATION_DRAFT);
  const [formOpen, setFormOpen] = useState(!initial?.length);
  const [problem, setProblem] = useState<string | null>(null);
  const blank = isBlankDraft(draft);
  const id = (field: string) => `${station}-${field}`;

  const update = (patch: Partial<StationDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setProblem(null);
  };

  /** Adds the filled-in form to the list; returns the new list, or null if the form is invalid. */
  function addDraft(): StationEntry[] | null {
    if (blank) return entries;
    const result = buildStation(station, draft);
    if (!result.ok) {
      setProblem(result.problem);
      return null;
    }
    const next = [...entries, result.entry];
    setEntries(next);
    setDraft(EMPTY_STATION_DRAFT);
    setFormOpen(false);
    return next;
  }

  function submit() {
    const list = addDraft();
    if (!list) return;
    onSubmit(
      list.map((entry) => entry.value),
      list.length ? list.map((entry) => entry.text).join("; ") : "Keine Angaben",
    );
  }

  function edit(index: number) {
    setDraft(entries[index].draft);
    setEntries((current) => current.filter((_, i) => i !== index));
    setFormOpen(true);
    setProblem(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Scrolls on small screens so the buttons below stay visible. */}
      <div className="flex max-h-[55dvh] flex-col gap-3 overflow-y-auto p-0.5">
        {entries.length > 0 && (
          <ul className="flex flex-col gap-2">
            {entries.map((entry, index) => (
              <li key={`${index}-${entry.text}`} className="flex items-center gap-1 rounded-lg border py-1.5 pr-1.5 pl-3 text-sm">
                <span className="min-w-0 flex-1">{entry.text}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => edit(index)}
                  disabled={disabled || !blank}
                  aria-label={`${entry.text} bearbeiten`}
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEntries((current) => current.filter((_, i) => i !== index))}
                  disabled={disabled}
                  aria-label={`${entry.text} entfernen`}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {formOpen ? (
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={id("title")}>{form.title.label}</Label>
              <Input
                id={id("title")}
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder={form.title.placeholder}
                maxLength={200}
                disabled={disabled}
                className="h-10"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={id("place")}>{form.place.label}</Label>
              <Input
                id={id("place")}
                value={draft.place}
                onChange={(e) => update({ place: e.target.value })}
                placeholder={form.place.placeholder}
                maxLength={200}
                disabled={disabled}
                className="h-10"
              />
            </div>
            {form.extended && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={id("type")}>Art (optional)</Label>
                  <select
                    id={id("type")}
                    className={selectClass}
                    value={draft.type}
                    onChange={(e) => update({ type: e.target.value })}
                    disabled={disabled}
                  >
                    <option value="">Keine Angabe</option>
                    {EXPERIENCE_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={id("location")}>Ort (optional)</Label>
                  <Input
                    id={id("location")}
                    value={draft.location}
                    onChange={(e) => update({ location: e.target.value })}
                    placeholder="z. B. München"
                    maxLength={100}
                    disabled={disabled}
                    className="h-10"
                  />
                </div>
              </>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={id("start-month")}>{form.startRequired ? "Von" : "Von (optional)"}</Label>
              <MonthSelect
                value={draft.start}
                onChange={(start) => update({ start })}
                disabled={disabled}
                idPrefix={id("start")}
                yearsFrom={STATION_YEARS_FROM}
                yearCount={STATION_YEAR_COUNT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={id("end-month")}>Bis</Label>
              <MonthSelect
                value={draft.end}
                onChange={(end) => update({ end })}
                disabled={disabled || draft.ongoing}
                idPrefix={id("end")}
                yearsFrom={STATION_YEARS_FROM}
                yearCount={STATION_YEAR_COUNT}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.ongoing}
                  onChange={(e) => update({ ongoing: e.target.checked, end: { month: "", year: "" } })}
                  disabled={disabled}
                  className="size-4 accent-primary"
                />
                läuft noch
              </label>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={id("details")}>{form.details.label}</Label>
              <Textarea
                id={id("details")}
                value={draft.details}
                onChange={(e) => update({ details: e.target.value })}
                placeholder={form.details.placeholder}
                maxLength={2500}
                rows={3}
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">
                Nur das, was stimmt: Dein Lebenslauf wird ausschließlich aus diesen Angaben formuliert.
              </p>
            </div>
            <Button variant="outline" className="sm:col-span-2 sm:justify-self-start" onClick={() => void addDraft()} disabled={disabled || blank}>
              <PlusIcon />
              {form.add}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="self-start"
            onClick={() => setFormOpen(true)}
            disabled={disabled || entries.length >= MAX_STATIONS}
          >
            <PlusIcon />
            {form.addAnother}
          </Button>
        )}
      </div>

      {problem && (
        <p className="text-xs text-destructive" role="alert">
          {problem}
        </p>
      )}
      <Button className="h-10 self-end px-4" onClick={submit} disabled={disabled}>
        {entries.length === 0 && blank ? "Keine, weiter" : "Weiter"}
      </Button>
    </div>
  );
}
