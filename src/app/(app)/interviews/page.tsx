import type { Metadata } from "next";
import { VideoIcon } from "lucide-react";
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
    />
  );
}
