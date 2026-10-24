import type { z } from "zod";
import { formatExperience, formatProject, formatVolunteering } from "@/lib/profile/labels";
import {
  experienceValueSchema,
  projectValueSchema,
  volunteeringValueSchema,
} from "@/lib/schemas/candidate-profile";
import type { StationKind } from "./steps";

/**
 * Form model for the station steps of the onboarding chat (experience,
 * projects, volunteering): one flat draft for all three, mapped to and from
 * the profile values. Pure logic; the chat input only renders it.
 */

export type MonthParts = { month: string; year: string };

export type StationDraft = {
  /** Role, or the project name. */
  title: string;
  /** Organization, or the project context. */
  place: string;
  /** Experience only: type of employment ("" = not set). */
  type: string;
  /** Experience only. */
  location: string;
  start: MonthParts;
  end: MonthParts;
  ongoing: boolean;
  /** One point per line. */
  details: string;
};

export const EMPTY_STATION_DRAFT: StationDraft = {
  title: "",
  place: "",
  type: "",
  location: "",
  start: { month: "", year: "" },
  end: { month: "", year: "" },
  ongoing: false,
  details: "",
};

/** A finished entry: the profile value, its chat text and the draft for editing it again. */
export type StationEntry = { value: unknown; text: string; draft: StationDraft };

type Field = { label: string; placeholder: string };

export type StationForm = {
  title: Field;
  place: Field & { required: boolean };
  /** Experience needs a start date; projects and volunteering may have none. */
  startRequired: boolean;
  /** Shows the type and location fields (experience only). */
  extended: boolean;
  details: Field;
  add: string;
  addAnother: string;
};

export const MAX_DETAILS = 8;
export const MAX_STATIONS = 30;
const MAX_DETAIL_LENGTH = 300;

export const STATION_FORMS: Record<StationKind, StationForm> = {
  experience: {
    title: { label: "Rolle", placeholder: "z. B. Werkstudent Strategy" },
    place: { label: "Unternehmen", placeholder: "z. B. Siemens AG", required: true },
    startRequired: true,
    extended: true,
    details: {
      label: "Was hast du dort gemacht? (ein Punkt pro Zeile)",
      placeholder: "z. B. Marktanalysen für den Vertrieb erstellt\nWöchentliches Reporting in Excel aufgebaut",
    },
    add: "Station hinzufügen",
    addAnother: "Weitere Station",
  },
  projects: {
    title: { label: "Projekt", placeholder: "z. B. Case Competition Strategie" },
    place: { label: "Rahmen (optional)", placeholder: "z. B. Uni-Seminar, Hackathon, privat", required: false },
    startRequired: false,
    extended: false,
    details: {
      label: "Was hast du beigetragen? (ein Punkt pro Zeile)",
      placeholder: "z. B. Markteintrittsstrategie im Team entwickelt\nErgebnis vor der Jury präsentiert",
    },
    add: "Projekt hinzufügen",
    addAnother: "Weiteres Projekt",
  },
  volunteering: {
    title: { label: "Rolle", placeholder: "z. B. Vorstand Finanzen" },
    place: { label: "Organisation", placeholder: "z. B. Fachschaft WiWi", required: true },
    startRequired: false,
    extended: false,
    details: {
      label: "Was machst du dort? (ein Punkt pro Zeile)",
      placeholder: "z. B. Budget der Erstsemesterwoche verwaltet\nTeam von Ehrenamtlichen koordiniert",
    },
    add: "Engagement hinzufügen",
    addAnother: "Weiteres Engagement",
  },
};

/** "2025-09" -> { year: "2025", month: "09" }; null -> empty parts. */
export function splitMonth(value: string | null | undefined): MonthParts {
  const [year = "", month = ""] = value?.split("-") ?? [];
  return { year, month };
}

/** Both parts -> "YYYY-MM", none -> null, only one -> undefined (incomplete). */
function joinMonth({ month, year }: MonthParts): string | null | undefined {
  if (!month && !year) return null;
  return month && year ? `${year}-${month}` : undefined;
}

/** One point per line; list markers people type ("- ", "• ") are removed. */
export function parseDetails(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim().replace(/^[-•*–]\s*/, "").trim())
    .filter(Boolean);
}

export function isBlankDraft(draft: StationDraft): boolean {
  return (
    !draft.title.trim() &&
    !draft.place.trim() &&
    !draft.type &&
    !draft.location.trim() &&
    joinMonth(draft.start) === null &&
    joinMonth(draft.end) === null &&
    !draft.ongoing &&
    !draft.details.trim()
  );
}

type Built = { ok: true; entry: StationEntry } | { ok: false; problem: string };

const problem = (text: string): Built => ({ ok: false, problem: text });

function finish<T>(parsed: z.ZodSafeParseResult<T>, format: (value: T) => string, draft: StationDraft): Built {
  if (!parsed.success) return problem("Bitte prüfe deine Angaben.");
  return { ok: true, entry: { value: parsed.data, text: format(parsed.data), draft } };
}

/** Checks a draft and turns it into a profile value; the problem text is shown to the user. */
export function buildStation(kind: StationKind, draft: StationDraft): Built {
  const form = STATION_FORMS[kind];
  if (!draft.title.trim()) return problem(`Bitte fülle „${form.title.label}“ aus.`);
  if (form.place.required && !draft.place.trim()) return problem(`Bitte fülle „${form.place.label}“ aus.`);

  const start = joinMonth(draft.start);
  const end = draft.ongoing ? null : joinMonth(draft.end);
  if (start === undefined || end === undefined) return problem("Bitte wähle bei einem Datum Monat und Jahr.");
  if (form.startRequired && !start) return problem("Bitte gib an, seit wann (Monat und Jahr).");
  if (end && !start) return problem("Bitte gib auch an, seit wann.");
  if (start && !end && !draft.ongoing) return problem("Bitte gib an, bis wann, oder hake „läuft noch“ an.");
  if (start && end && end < start) return problem("Das Ende liegt vor dem Start.");

  const details = parseDetails(draft.details);
  if (details.length > MAX_DETAILS) return problem(`Bitte höchstens ${MAX_DETAILS} Punkte.`);
  if (details.some((d) => d.length > MAX_DETAIL_LENGTH)) {
    return problem(`Ein Punkt ist zu lang (höchstens ${MAX_DETAIL_LENGTH} Zeichen).`);
  }

  const common = { start, end, details };
  switch (kind) {
    case "experience":
      return finish(
        experienceValueSchema.safeParse({
          organization: draft.place,
          role: draft.title,
          type: draft.type || null,
          location: draft.location.trim() || null,
          ...common,
        }),
        formatExperience,
        draft,
      );
    case "projects":
      return finish(
        projectValueSchema.safeParse({ name: draft.title, context: draft.place.trim() || null, ...common }),
        formatProject,
        draft,
      );
    case "volunteering":
      return finish(
        volunteeringValueSchema.safeParse({ organization: draft.place, role: draft.title, ...common }),
        formatVolunteering,
        draft,
      );
  }
}

function draftFields(value: { start: string | null; end: string | null; details: string[] }) {
  return {
    start: splitMonth(value.start),
    end: splitMonth(value.end),
    ongoing: value.start !== null && value.end === null,
    details: value.details.join("\n"),
  };
}

/** An entry from a stored profile value (prefill when the chat is repeated); null if it does not fit. */
export function stationFromValue(kind: StationKind, value: unknown): StationEntry | null {
  switch (kind) {
    case "experience": {
      const parsed = experienceValueSchema.safeParse(value);
      if (!parsed.success) return null;
      const v = parsed.data;
      const draft = {
        ...EMPTY_STATION_DRAFT,
        ...draftFields(v),
        title: v.role,
        place: v.organization,
        type: v.type ?? "",
        location: v.location ?? "",
      };
      return { value: v, text: formatExperience(v), draft };
    }
    case "projects": {
      const parsed = projectValueSchema.safeParse(value);
      if (!parsed.success) return null;
      const v = parsed.data;
      return {
        value: v,
        text: formatProject(v),
        draft: { ...EMPTY_STATION_DRAFT, ...draftFields(v), title: v.name, place: v.context ?? "" },
      };
    }
    case "volunteering": {
      const parsed = volunteeringValueSchema.safeParse(value);
      if (!parsed.success) return null;
      const v = parsed.data;
      return {
        value: v,
        text: formatVolunteering(v),
        draft: { ...EMPTY_STATION_DRAFT, ...draftFields(v), title: v.role, place: v.organization },
      };
    }
  }
}
