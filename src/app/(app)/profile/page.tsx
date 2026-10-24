import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DownloadIcon, MessageCircleIcon } from "lucide-react";
import { PersonaAvatar } from "@/components/onboarding/persona-avatar";
import { SuggestionActions } from "@/components/profile/suggestion-actions";
import { buttonVariants } from "@/components/ui/button";
import {
  EMPLOYMENT_TYPE_LABELS,
  formatEducation,
  formatLanguage,
  formatYearMonth,
  TRACK_LABELS,
} from "@/lib/profile/labels";
import { profileCompleteness } from "@/lib/profile/merge";
import { getCandidateProfileRecord } from "@/lib/profile/server";
import type { ProfileSource, ProfileTarget } from "@/lib/schemas/candidate-profile";

export const metadata: Metadata = { title: "Mein Profil" };

const SOURCE_LABELS: Record<ProfileSource, string> = {
  user: "von dir",
  resume: "aus dem Lebenslauf",
  experience: "aus einer Erfahrung",
  interview: "aus einem Interview",
};

export default function ProfilePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mein Profil</h1>
        <p className="text-muted-foreground">
          Die Grundlage für Interviews, Lebenslauf und Stellenvorschläge. Automatisch erkannte Angaben
          nutzt die App erst, wenn du sie übernimmst.
        </p>
      </header>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

type Row = {
  key: string;
  label: string;
  text: string | null;
  source?: ProfileSource;
  confirmed?: boolean;
  target?: ProfileTarget;
};

async function ProfileContent() {
  const record = await getCandidateProfileRecord();
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
    {
      title: "Ausbildung",
      rows: profile.education.map((e) => ({
        key: e.id,
        label: "",
        text: formatEducation(e.value),
        source: e.source,
        confirmed: e.confirmed,
        target: { list: "education", id: e.id },
      })),
    },
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
    {
      title: "Fähigkeiten",
      rows: profile.skills.map((s) => ({
        key: s.id,
        label: "",
        text: s.value,
        source: s.source,
        confirmed: s.confirmed,
        target: { list: "skills", id: s.id },
      })),
    },
    {
      title: "Sprachen",
      rows: profile.languages.map((l) => ({
        key: l.id,
        label: "",
        text: formatLanguage(l.value),
        source: l.source,
        confirmed: l.confirmed,
        target: { list: "languages", id: l.id },
      })),
    },
  ];

  return (
    <>
      <section className="flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center">
        <PersonaAvatar className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-sm">
            Dein Profil ist zu <strong>{completeness} %</strong> ausgefüllt.
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
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

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
          {section.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Noch keine Angaben.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {section.rows.map((row) => (
                <li key={row.key} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {row.label && <span className="text-xs text-muted-foreground">{row.label}</span>}
                    <span className={row.text ? "text-sm" : "text-sm text-muted-foreground"}>
                      {row.text ?? "Keine Angabe"}
                    </span>
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
