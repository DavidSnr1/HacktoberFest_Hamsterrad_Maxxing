import { FileTextIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ResumeStartForm, type ExistingResumes } from "@/components/resume/resume-start-form";
import { hasConsent } from "@/lib/consent/server";
import { isProfileEmpty } from "@/lib/resume/profile";
import { getResumeProfile } from "@/lib/resume/profile-source";
import { listResumeDocuments } from "@/lib/resume/repository";
import { TRACK_TEMPLATES } from "@/lib/resume/tracks";
import { RESUME_TRACKS, resumeTrackSchema } from "@/lib/schemas/resume";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Lebenslauf",
};

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export default async function ResumePage({ searchParams }: PageProps<"/resume">) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const { track } = await searchParams;
  const initialTrack = resumeTrackSchema.safeParse(track).data;
  // TODO(merge, TEAM-KONTEXT 5.2): hand-over from the job search (`/resume?jobId=…&track=…`).
  //   `track` from the URL already preselects the resume; the role still needs the job:
  //   const { jobId } = await searchParams;
  //   const job = typeof jobId === "string" ? await getJobPostingText(jobId) : null;
  //   <ResumeStartForm … initialRole={job?.title} initialTrack={job?.track ?? initialTrack} />

  const [documents, profile, consentGranted] = await Promise.all([
    listResumeDocuments(),
    getResumeProfile(user),
    hasConsent("resume"),
  ]);
  const existing: ExistingResumes = Object.fromEntries(
    documents.map((doc) => [doc.track, { id: doc.id, language: doc.language, targetRole: doc.targetRole }]),
  );
  const profileMissing = !profile || isProfileEmpty(profile);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Lebenslauf</h1>
        <p className="text-sm text-muted-foreground">
          Du hast drei Lebensläufe – je einen für Finance, Consulting und Startup. Aufbau und Zuschnitt richten sich nach dem Bereich, die
          Rolle, auf die du dich bewirbst, steht oben im Lebenslauf. Wir nutzen nur, was in deinem Profil steht.
        </p>
      </div>

      {profileMissing ? (
        <div className="rounded-lg border border-dashed p-6 text-sm">
          <p className="font-medium">Dein Profil ist noch leer</p>
          <p className="mt-1 text-muted-foreground">
            Vervollständige zuerst dein Profil mit Ausbildung und Kenntnissen. Daraus entstehen dann deine Lebensläufe.
          </p>
          <Link href="/profile" className="mt-2 inline-block font-medium text-primary hover:underline">
            Zu deinem Profil
          </Link>
        </div>
      ) : (
        <ResumeStartForm
          key={initialTrack ?? "none"}
          existing={existing}
          consentGranted={consentGranted}
          initialTrack={initialTrack}
        />
      )}

      <section aria-labelledby="resume-list-title" className="space-y-3">
        <h2 id="resume-list-title" className="font-semibold">
          Deine Lebensläufe
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {RESUME_TRACKS.map((value) => {
            const template = TRACK_TEMPLATES[value];
            const doc = documents.find((d) => d.track === value);
            return (
              <li key={value}>
                {doc ? (
                  <Link href={`/resume/${doc.id}`} className="block h-full rounded-lg border p-4 transition-colors hover:bg-muted">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{template.label}</p>
                    <p className="mt-1 font-medium break-words">{doc.targetRole}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {doc.language === "en" ? "Englisch" : "Deutsch"} · Version {doc.activeVersion} · {dateFormat.format(new Date(doc.updatedAt))}
                    </p>
                  </Link>
                ) : (
                  <div className="flex h-full flex-col rounded-lg border border-dashed p-4">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{template.label}</p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <FileTextIcon className="size-4" aria-hidden />
                      Noch nicht erstellt
                    </p>
                    {!profileMissing ? (
                      <Link href={`/resume?track=${value}#start`} className="mt-2 text-sm font-medium text-primary hover:underline">
                        {template.label}-Lebenslauf erstellen
                      </Link>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
