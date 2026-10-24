"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FlameIcon } from "lucide-react";
import { toast } from "sonner";
import { markLevelSeen } from "@/lib/gamification/actions";
import type { LevelProgress, Level } from "@/lib/gamification/levels";
import { PERSONAS, VIBE_LABELS, type Vibe } from "@/lib/gamification/personas";
import type { StreakInfo } from "@/lib/gamification/streak";
import { Avatar } from "./avatar";

const numberFormat = new Intl.NumberFormat("de-DE");

type CharacterHeroProps = {
  progress: LevelProgress;
  vibe: Vibe;
  vibeFromProfile: boolean;
  streak: StreakInfo;
  lastSeenLevel: Level | null;
};

/** Avatar, level title and XP bar; celebrates a level the user has not seen yet. */
export function CharacterHero({ progress, vibe, vibeFromProfile, streak, lastSeenLevel }: CharacterHeroProps) {
  const { level, xp, nextLevelXp, percent } = progress;
  const persona = PERSONAS[vibe][level];
  // The first visit only records the level; later rises are celebrated.
  const [celebrating, setCelebrating] = useState(lastSeenLevel !== null && level > lastSeenLevel);
  const stored = useRef(false);

  useEffect(() => {
    if (stored.current || lastSeenLevel === level) return;
    stored.current = true;
    if (celebrating) {
      toast.success(`Level-up! Willkommen auf Level ${level}: ${persona.title}`);
      window.setTimeout(() => setCelebrating(false), 1800);
    }
    void markLevelSeen().then((result) => {
      if (!result.ok) console.error("character: last seen level not stored");
    });
  }, [celebrating, lastSeenLevel, level, persona.title]);

  return (
    <section className="grid overflow-hidden rounded-xl border bg-card md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="relative flex min-h-80 items-end justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_100%,oklch(0.93_0.03_120)_0,transparent_45%),linear-gradient(180deg,oklch(0.99_0.004_256),oklch(0.96_0.008_256))] pt-6">
        <div className="absolute bottom-3 h-6 w-56 rounded-[50%] bg-foreground/10 blur-md" aria-hidden />
        <Avatar vibe={vibe} level={level} scale={1.05} animated celebrating={celebrating} className="relative mb-4" />
      </div>

      <div className="flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            Level {level}
          </span>
          <span className="text-xs font-medium text-muted-foreground">{VIBE_LABELS[vibe]}</span>
          <span
            className="ml-auto flex items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1 text-xs font-semibold"
            title={streak.activeToday ? "Heute schon aktiv" : "Heute noch nicht aktiv"}
          >
            <FlameIcon className="size-3.5 text-gold" aria-hidden />
            {streak.current} {streak.current === 1 ? "Tag" : "Tage"} Streak
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-semibold tracking-tight">{persona.title}</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{persona.description}</p>
          <p className="font-heading text-base italic">„{persona.quote}“</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{numberFormat.format(xp)} XP</span>
              {nextLevelXp !== null && ` / ${numberFormat.format(nextLevelXp)} XP`}
            </span>
            <span>
              {nextLevelXp === null
                ? "Max-Level erreicht"
                : `Noch ${numberFormat.format(nextLevelXp - xp)} XP bis Level ${level + 1}`}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Fortschritt zum nächsten Level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>

        {!vibeFromProfile && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Dein Look folgt dem ersten Bereich in deinem{" "}
            <Link href="/profile" className="font-medium text-foreground underline underline-offset-2">
              Profil
            </Link>
            . Solange dort keiner steht, zeigen wir Consulting.
          </p>
        )}
      </div>
    </section>
  );
}
