import {
  FileTextIcon,
  FlameIcon,
  LayersIcon,
  MicIcon,
  StarIcon,
  UserRoundCheckIcon,
  type LucideIcon,
} from "lucide-react";
import type { Badge } from "@/lib/gamification/badges";
import type { CharacterState } from "@/lib/gamification/server";
import { cn } from "@/lib/utils";

const ICONS: Record<Badge["icon"], LucideIcon> = {
  mic: MicIcon,
  layers: LayersIcon,
  flame: FlameIcon,
  star: StarIcon,
  file: FileTextIcon,
  user: UserRoundCheckIcon,
};

export function BadgeList({ badges }: { badges: CharacterState["badges"] }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <section className="flex flex-col gap-4" aria-labelledby="badges-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="badges-title" className="text-xl font-semibold tracking-tight">
          Badges
        </h2>
        <span className="text-sm text-muted-foreground">
          {earned} von {badges.length}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badges.map((badge) => {
          const Icon = ICONS[badge.icon];
          return (
            <li
              key={badge.id}
              className={cn("flex items-start gap-3 rounded-lg border bg-card p-3", !badge.earned && "opacity-55")}
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  badge.earned ? "bg-gold/20 text-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-4.5" aria-hidden />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm font-semibold">
                  {badge.title}
                  <span className="sr-only">{badge.earned ? " (erreicht)" : " (noch offen)"}</span>
                </p>
                <p className="text-xs leading-snug text-muted-foreground">{badge.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
