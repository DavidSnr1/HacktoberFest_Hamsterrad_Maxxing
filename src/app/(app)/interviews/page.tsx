import type { Metadata } from "next";
import { Suspense } from "react";
import { BriefcaseIcon, RocketIcon, TrendingUpIcon, type LucideIcon } from "lucide-react";
import { TRACK_COLORS } from "@/components/interview/track-colors";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
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
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Interviewtraining"
          title="Mock Interviews"
          description="Wähle einen Track. Ein KI-Interviewer führt mit dir ein realistisches Gespräch per Sprache, etwa 15 bis 20 Minuten."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {TRACK_ORDER.map((track) => (
            <TrackCard key={track} track={track} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Deine letzten Interviews</h2>
        <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-muted" />}>
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
    <Card className={cn("pt-0", TRACK_COLORS[track])}>
      <div className="relative isolate flex h-20 items-end sm:h-28 justify-between overflow-hidden bg-(--track) px-4 pb-3 text-white">
        <Icon className="absolute -top-3 -right-3 -z-10 size-28 stroke-[1.25] text-white/20" aria-hidden />
        <span className="font-heading text-2xl font-semibold tracking-tight">{config.label}</span>
        {!config.enabled && (
          <Badge variant="outline" className="border-white/40 bg-white/15 text-white">
            Bald verfügbar
          </Badge>
        )}
      </div>
      <CardHeader className="gap-2">
        <CardTitle className="sr-only">{config.label}</CardTitle>
        <CardDescription className="text-foreground">{config.tagline}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {config.topics.map((topic) => (
            <li key={topic} className="flex gap-2.5">
              <span className="mt-[0.45rem] size-1.5 shrink-0 bg-(--track)" aria-hidden />
              {topic}
            </li>
          ))}
        </ul>
        <p className="mt-auto border-t pt-3 text-xs text-muted-foreground">
          Interviewer: <span className="font-medium text-foreground">{config.interviewer.name}</span>,{" "}
          {config.interviewer.role}
        </p>
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
