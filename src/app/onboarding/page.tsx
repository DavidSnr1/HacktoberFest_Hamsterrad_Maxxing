import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loader2Icon } from "lucide-react";
import { OnboardingChat } from "@/components/onboarding/onboarding-chat";
import { getStepPrefill } from "@/lib/onboarding/steps";
import { getCandidateProfileRecord } from "@/lib/profile/server";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dein Profil" };

/** Onboarding chat, shown after the first login (outside the tab layout). */
export default function OnboardingPage() {
  return (
    <main className="flex h-dvh flex-col bg-background">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center" role="status" aria-label="Wird geladen">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-hidden />
          </div>
        }
      >
        <OnboardingLoader />
      </Suspense>
    </main>
  );
}

async function OnboardingLoader() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const record = await getCandidateProfileRecord();
  return <OnboardingChat prefill={record ? getStepPrefill(record.profile) : {}} />;
}
