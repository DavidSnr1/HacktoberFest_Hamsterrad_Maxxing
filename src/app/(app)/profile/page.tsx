import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DownloadIcon, MessageCircleIcon } from "lucide-react";
import { PersonaAvatar } from "@/components/onboarding/persona-avatar";
import { PageHeader } from "@/components/page-header";
import { DisplayNameForm } from "@/components/profile/display-name-form";
import { SuggestionActions } from "@/components/profile/suggestion-actions";
import { buttonVariants } from "@/components/ui/button";
import {
  EMPLOYMENT_TYPE_LABELS,
  formatEducation,
  formatExperience,
  formatLanguage,
  formatProject,
  formatVolunteering,
  formatYearMonth,
  TRACK_LABELS,
} from "@/lib/profile/labels";
import { profileCompleteness } from "@/lib/profile/merge";
import { getCandidateProfileRecord, getDisplayName } from "@/lib/profile/server";
import type { ListField, ProfileSource, ProfileTarget } from "@/lib/schemas/candidate-profile";

export const metadata: Metadata = { title: "Mein Profil" };

const SOURCE_LABELS: Record<ProfileSource, string> = {
  user: "von dir",
  resume: "aus dem Lebenslauf",
  experience: "aus einer Erfahrung",
  interview: "aus einem Interview",
};

export default function ProfilePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHeader
        title="Mein Profil"
        description="Die Grundlage für Interviews, Lebenslauf und Stellenvorschläge. Automatisch erkannte Angaben nutzt die App erst, wenn du sie übernimmst."
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

type Row = {
  key: string;
  label: string;
  text: string | null;
  /** Points under the entry (what the person did at a station). */
  details?: string[];
  source?: ProfileSource;
  confirmed?: boolean;
  target?: ProfileTarget;
};

type ListItem<T> = { id: string; value: T; source: ProfileSource; confirmed: boolean };

function listRows<T>(
  list: ListField,
  items: ListItem<T>[],
  format: (value: T) => string,
  details?: (value: T) => string[],
): Row[] {
  return items.map((item) => ({
    key: item.id,
    label: "",
    text: format(item.value),
    details: details?.(item.value),
    source: item.source,
    confirmed: item.confirmed,
    target: { list, id: item.id },
  }));
}

const stationDetails = (value: { details: string[] }) => value.details;

async function ProfileContent() {
  const [record, displayName] = await Promise.all([getCandidateProfileRecord(), getDisplayName()]);
  if (!record?.available) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Dein Profil konnte nicht geladen werden. Bitte versuche es später erneut.
      </p>
    );
  }
  const { profile } = record;
  const completeness = Math.round(profileCompleteness(profile) * 100);
  const g = profile.goals;

  const scalar = <T,>(
    key: string,
    label: string,
    entry: { value: T; source: ProfileSource; confirmed: boolean } | null,
    format: (value: T) => string,
    target: ProfileTarget,
  ): Row => ({
    key,
    label,
    text: entry ? format(entry.value) : null,
    source: entry?.source,
    confirmed: entry?.confirmed,
    target,
  });

  const sections: { title: string; rows: Row[] }[] = [
    { title: "Ausbildung", rows: listRows("education", profile.education, formatEducation) },
    { title: "Praxiserfahrung", rows: listRows("experience", profile.experience, formatExperience, stationDetails) },
    { title: "Projekte", rows: listRows("projects", profile.projects, formatProject, stationDetails) },
    { title: "Ehrenamt", rows: listRows("volunteering", profile.volunteering, formatVolunteering, stationDetails) },
    {
      title: "Ziele",
      rows: [
        scalar("tracks", "Bereiche", g.tracks, (v) => v.map((t) => TRACK_LABELS[t]).join(", "), { section: "goals", field: "tracks" }),
        scalar("types", "Art der Stelle", g.employmentTypes, (v) => v.map((t) => EMPLOYMENT_TYPE_LABELS[t]).join(", "), { section: "goals", field: "employmentTypes" }),
        scalar("places", "Wunschorte", g.preferredLocations, (v) => v.join(", "), { section: "goals", field: "preferredLocations" }),
        scalar("remote", "Remote/hybrid", g.remoteOk, (v) => (v ? "ja" : "nein"), { section: "goals", field: "remoteOk" }),
        scalar("start", "Frühester Start", g.earliestStart, formatYearMonth, { section: "goals", field: "earliestStart" }),
        scalar("location", "Wohnort", profile.basics.location, (v) => v, { section: "basics", field: "location" }),
      ],
    },
    { title: "Fähigkeiten", rows: listRows("skills", profile.skills, (skill) => skill) },
    { title: "Sprachen", rows: listRows("languages", profile.languages, formatLanguage) },
  ];

  return (
    <>
      <section className="flex flex-col gap-4 rounded-lg border bg-card p-5 sm:flex-row sm:items-center">
        <PersonaAvatar className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Dein Profil ist zu{" "}
            <strong className="font-heading text-2xl font-semibold text-foreground tabular-nums">{completeness} %</strong>{" "}
            ausgefüllt.
          </p>
          <div className="h-1.5 overflow-hidden bg-muted" aria-hidden>
            <div className="h-full bg-primary" style={{ width: `${completeness}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/onboarding" className={buttonVariants()}>
            <MessageCircleIcon aria-hidden />
            Mit Maximilian aktualisieren
          </Link>
          <a href="/api/profile/export" download className={buttonVariants({ variant: "outline" })}>
            <DownloadIcon aria-hidden />
            Als JSON
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Name</h2>
        <p className="text-sm text-muted-foreground">Steht oben in deinen Lebensläufen und im Export.</p>
        <DisplayNameForm key={displayName ?? ""} initialName={displayName} />
      </section>

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
          {section.rows.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Noch keine Angaben.</p>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {section.rows.map((row) => (
                <li
                  key={row.key}
                  className={row.confirmed === false ? "flex items-center gap-3 bg-secondary/60 px-4 py-3" : "flex items-center gap-3 px-4 py-3"}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {row.label && (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {row.label}
                      </span>
                    )}
                    <span className={row.text ? "text-sm" : "text-sm text-muted-foreground"}>
                      {row.text ?? "Keine Angabe"}
                    </span>
                    {row.details && row.details.length > 0 && (
                      <ul className="list-disc pl-4 text-sm text-muted-foreground marker:text-muted-foreground">
                        {row.details.map((detail, i) => (
                          <li key={i}>{detail}</li>
                        ))}
                      </ul>
                    )}
                    {row.source && (
                      <span className="text-xs text-muted-foreground">
                        {SOURCE_LABELS[row.source]}
                        {row.confirmed === false && " · Vorschlag, noch nicht übernommen"}
                      </span>
                    )}
                  </div>
                  {row.confirmed === false && row.target && <SuggestionActions target={row.target} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
