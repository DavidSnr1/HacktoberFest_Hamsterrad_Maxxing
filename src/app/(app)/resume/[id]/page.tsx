import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PageHeader } from "@/components/page-header";
import { ResumeWorkspace } from "@/components/resume/resume-workspace";
import { hasConsent } from "@/lib/consent/server";
import { getDisplayName } from "@/lib/profile/server";
import { isOutdated } from "@/lib/resume/candidate-profile";
import { diffResumes } from "@/lib/resume/diff";
import { getProfileChangedAt } from "@/lib/resume/profile-source";
import { activeVersionOf, draftVersionOf, getResumeDocument } from "@/lib/resume/repository";
import { TRACK_TEMPLATES, withName } from "@/lib/resume/tracks";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Lebenslauf",
};

export default async function ResumeDetailPage({ params }: PageProps<"/resume/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await getCurrentUser();
  if (!user) notFound();
  const [doc, consentGranted, name, changedAt] = await Promise.all([
    getResumeDocument(id),
    hasConsent("resume"),
    getDisplayName(),
    getProfileChangedAt(user),
  ]);
  if (!doc) notFound();

  const active = activeVersionOf(doc);
  const draft = draftVersionOf(doc);
  const changes = active && draft ? diffResumes(active.content, draft.content) : [];
  const outdated = active !== null && isOutdated(active.createdAt, changedAt);

  return (
    <div className="space-y-6">
      <Link href="/resume" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden />
        Alle Lebensläufe
      </Link>
      <PageHeader title={`${TRACK_TEMPLATES[doc.track].label}-Lebenslauf`} />
      {/* Remount on a new active version so the version picker and inputs start fresh. */}
      <ResumeWorkspace
        key={doc.activeVersion}
        id={doc.id}
        track={doc.track}
        targetRole={doc.targetRole}
        language={doc.language}
        activeVersion={doc.activeVersion}
        versions={doc.versions.map((v) => ({ ...v, content: withName(v.content, name) }))}
        draft={draft && changes.length > 0 ? { version: draft.version, note: draft.notes, changes } : null}
        consentGranted={consentGranted}
        outdated={outdated}
      />
    </div>
  );
}
