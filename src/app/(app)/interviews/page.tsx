import type { Metadata } from "next";
import { VideoIcon } from "lucide-react";
import { ConsentGatedAction } from "@/components/consent-gated-action";
import { TabPlaceholder } from "@/components/tab-placeholder";

export const metadata: Metadata = { title: "Interviews" };

export default function InterviewsPage() {
  return (
    <TabPlaceholder
      title="Mock Interviews"
      description="Übe realistische Bewerbungsgespräche mit einem KI-Interviewer."
      icon={VideoIcon}
      upcoming={[
        "Tracks: Startup, Consulting, Finance",
        "Gespräch per Sprache im Video-Call-Look",
        "Transkript und strukturiertes Feedback",
      ]}
      action={
        <ConsentGatedAction
          consentType="voice"
          comingSoonMessage="Einwilligung liegt vor. Das Live-Interview wird gerade gebaut."
        >
          Interview starten
        </ConsentGatedAction>
      }
    />
  );
}
