import type { Metadata } from "next";

import { JobsView } from "@/components/jobs/jobs-view";
import { getJobPreferences } from "@/lib/jobs/profile-source";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Stellen",
};

export default async function JobsPage() {
  const user = await getCurrentUser();
  const preferences = user ? await getJobPreferences(user.id) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Stellen</h1>
        <p className="text-sm text-muted-foreground">
          {preferences
            ? "Passend zu deinem Profil vorausgewählt. Pass die Suche an oder wähle unten andere Werte aus deinem Profil."
            : "Finde Praktika, Werkstudentenjobs und Einstiegsstellen und pass deinen Lebenslauf mit einem Klick darauf an."}
        </p>
      </div>
      <JobsView preferences={preferences} />
    </div>
  );
}
