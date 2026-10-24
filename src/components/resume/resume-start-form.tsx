"use client";

import { CheckIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { suggestTrack, TRACK_TEMPLATES } from "@/lib/resume/tracks";
import { RESUME_TRACKS, type ResumeLanguage, type ResumeTrack } from "@/lib/schemas/resume";

import { generateResume, updateResume } from "./resume-api";
import { useResumeConsent } from "./resume-consent";

export type ExistingResumes = Partial<Record<ResumeTrack, { id: string; language: ResumeLanguage; targetRole: string }>>;

type Props = {
  existing: ExistingResumes;
  /** Result of `hasConsent("resume")` on the server. */
  consentGranted: boolean;
  /** Pre-filled role, e.g. the job title handed over from the job search. */
  initialRole?: string;
  initialTrack?: ResumeTrack;
};

const LANGUAGE_LABELS: Record<ResumeLanguage, string> = { de: "Deutsch", en: "Englisch" };

/**
 * Role input + track choice. Creates the resume for the track, or – if it
 * already exists – takes the role over (same language) or rebuilds it (other language).
 */
export function ResumeStartForm({ existing, consentGranted, initialRole = "", initialTrack }: Props) {
  const router = useRouter();
  const { requireConsent, consentDialog } = useResumeConsent(consentGranted);
  const [role, setRole] = useState(initialRole);
  const [track, setTrack] = useState<ResumeTrack | null>(initialTrack ?? suggestTrack(initialRole));
  const [trackTouched, setTrackTouched] = useState(Boolean(initialTrack));
  const [languageChoice, setLanguageChoice] = useState<ResumeLanguage | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = track ? existing[track] : undefined;
  const language: ResumeLanguage = languageChoice ?? current?.language ?? "de";
  const action = !track ? null : !current ? "create" : current.language === language ? "role" : "rebuild";
  const label = track ? TRACK_TEMPLATES[track].label : "";

  function changeRole(value: string) {
    setRole(value);
    if (!trackTouched) setTrack(suggestTrack(value));
  }

  function chooseTrack(value: ResumeTrack) {
    setTrack(value);
    setTrackTouched(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!track || !action) return;
    requireConsent(() => void run(track, action));
  }

  async function run(selectedTrack: ResumeTrack, mode: NonNullable<typeof action>) {
    setPending(true);
    setError(null);
    try {
      const targetRole = role.trim();
      let id: string;
      if (mode === "role" && current) {
        await updateResume(current.id, { targetRole });
        id = current.id;
      } else {
        ({ id } = await generateResume({ track: selectedTrack, targetRole, language }));
      }
      router.push(`/resume/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Etwas ist schiefgelaufen.");
      setPending(false);
    }
  }

  const submitLabel =
    action === "role"
      ? `Rolle in deinen ${label}-Lebenslauf übernehmen`
      : action === "rebuild"
        ? `${label}-Lebenslauf auf ${LANGUAGE_LABELS[language]} neu erstellen`
        : action === "create"
          ? `${label}-Lebenslauf erstellen`
          : "Wähle einen Bereich";

  return (
    <form id="start" onSubmit={submit} className="space-y-5 rounded-lg border p-4 sm:p-5">
      <div className="space-y-2">
        <label htmlFor="target-role" className="text-sm font-medium">
          Auf welche Rolle bewirbst du dich?
        </label>
        <Input
          id="target-role"
          value={role}
          onChange={(e) => changeRole(e.target.value)}
          placeholder="z. B. Werkstudent Strategy Consulting"
          maxLength={120}
          disabled={pending}
          required
        />
        <p className="text-xs text-muted-foreground">Die Rolle steht oben in deinem Lebenslauf, direkt unter deinem Namen.</p>
      </div>

      <fieldset className="space-y-2" disabled={pending}>
        <legend className="text-sm font-medium">Bereich</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {RESUME_TRACKS.map((value) => {
            const template = TRACK_TEMPLATES[value];
            const selected = track === value;
            return (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  selected ? "border-primary bg-primary/5" : "hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name="track"
                  value={value}
                  checked={selected}
                  onChange={() => chooseTrack(value)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between font-medium">
                  {template.label}
                  {selected ? <CheckIcon className="size-4 text-primary" aria-hidden /> : null}
                </span>
                <span className="text-xs text-muted-foreground">{template.description}</span>
                {existing[value] ? <span className="text-xs text-muted-foreground">Lebenslauf vorhanden</span> : null}
              </label>
            );
          })}
        </div>
        {!track && role.trim().length >= 3 ? (
          <p className="text-xs text-muted-foreground">Wir konnten den Bereich nicht erkennen – wähl ihn bitte aus.</p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2" disabled={pending}>
        <legend className="text-sm font-medium">Sprache</legend>
        <div className="flex gap-4 text-sm">
          {(Object.keys(LANGUAGE_LABELS) as ResumeLanguage[]).map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" name="language" value={value} checked={language === value} onChange={() => setLanguageChoice(value)} />
              {LANGUAGE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      {action === "role" ? (
        <p className="text-sm text-muted-foreground">
          Du hast schon einen {label}-Lebenslauf. Aufbau und Inhalt bleiben gleich, nur die Rolle wird übernommen.
        </p>
      ) : null}
      {action === "rebuild" ? (
        <p className="text-sm text-muted-foreground">
          Dein {label}-Lebenslauf ist auf {LANGUAGE_LABELS[current?.language ?? "de"]}. Er wird auf {LANGUAGE_LABELS[language]} neu
          erstellt; ältere Versionen bleiben abrufbar.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || !action || role.trim().length < 3} className="w-full sm:w-auto">
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <SparklesIcon aria-hidden />}
        {pending && action !== "role" ? "Lebenslauf wird erstellt …" : submitLabel}
      </Button>
      {consentDialog}
      {pending && action !== "role" ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Wir wählen die passenden Einträge aus deinem Profil aus und formulieren sie für {label}. Das dauert meist 20–40 Sekunden.
        </p>
      ) : null}
    </form>
  );
}
