import type { Metadata } from "next";
import { Suspense } from "react";
import { BriefcaseIcon, RocketIcon, TrendingUpIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasConsent } from "@/lib/consent/server";
import { TRACK_ORDER, TRACKS, type InterviewTrack } from "@/lib/interview/tracks";
import { RecentInterviews } from "./recent-interviews";
import { StartInterviewButton } from "./start-interview-button";

export const metadata: Metadata = { title: "Interviews" };

const TRACK_ICONS: Record<InterviewTrack, LucideIcon> = {
  consulting: BriefcaseIcon,
  finance: TrendingUpIcon,
  startup: RocketIcon,
};

export default function InterviewsPage() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mock Interviews</h1>
          <p className="text-muted-foreground">
            Wähle einen Track. Ein KI-Interviewer führt mit dir ein realistisches Gespräch
            per Sprache, etwa 15 bis 20 Minuten.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {TRACK_ORDER.map((track) => (
            <TrackCard key={track} track={track} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Deine letzten Interviews</h2>
        <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-muted" />}>
          <RecentInterviews />
        </Suspense>
      </section>
    </div>
  );
}

function TrackCard({ track }: { track: InterviewTrack }) {
  const config = TRACKS[track];
  const Icon = TRACK_ICONS[track];

  return (
    <Card className={config.enabled ? undefined : "opacity-60"}>
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-5" aria-hidden />
        </div>
        <CardTitle className="flex items-center gap-2 text-lg">
          {config.label}
          {!config.enabled && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Bald verfügbar
            </span>
          )}
        </CardTitle>
        <CardDescription>{config.tagline}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
          {config.topics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {config.enabled ? (
          <Suspense
            fallback={
              <Button size="lg" className="h-10 w-full" disabled>
                Interview starten
              </Button>
            }
          >
            <EnabledTrackAction track={track} />
          </Suspense>
        ) : (
          <Button size="lg" variant="outline" className="h-10 w-full" disabled>
            Bald verfügbar
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

async function EnabledTrackAction({ track }: { track: InterviewTrack }) {
  const voiceConsentGranted = await hasConsent("voice");
  return <StartInterviewButton track={track} voiceConsentGranted={voiceConsentGranted} />;
}
