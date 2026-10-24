import { LEVEL_THRESHOLDS, type Level } from "@/lib/gamification/levels";
import { PERSONAS, VIBE_LABELS, VIBE_ORDER, type Vibe } from "@/lib/gamification/personas";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

const LEVELS: Level[] = [1, 2, 3];
const numberFormat = new Intl.NumberFormat("de-DE");

/** All personas, the user's vibe first; the current one is highlighted. */
export function PersonaGallery({ vibe, level }: { vibe: Vibe; level: Level }) {
  const vibes = [vibe, ...VIBE_ORDER.filter((v) => v !== vibe)];
  return (
    <section className="flex flex-col gap-6" aria-labelledby="personas-title">
      <div className="flex flex-col gap-1">
        <h2 id="personas-title" className="text-xl font-semibold tracking-tight">
          Alle Level im Überblick
        </h2>
        <p className="text-sm text-muted-foreground">
          Mit jedem Level werden Outfit, Kulisse und Branchenklischees eine Spur größer.
        </p>
      </div>
      {vibes.map((v) => (
        <div key={v} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground">{VIBE_LABELS[v]}</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {LEVELS.map((l) => {
              const persona = PERSONAS[v][l];
              const current = v === vibe && l === level;
              return (
                <li
                  key={l}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-lg border bg-card",
                    current && "border-foreground ring-2 ring-marker",
                  )}
                  aria-current={current ? "true" : undefined}
                >
                  <Avatar vibe={v} level={l} sizes="(min-width: 640px) 33vw, 50vw" decorative className="aspect-[4/5] bg-muted/60" />
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      Level {l}
                      {current && <span className="highlight text-foreground">Du</span>}
                    </p>
                    <p className="text-sm font-semibold">{persona.title}</p>
                    <p className="text-xs leading-snug text-muted-foreground">{persona.description}</p>
                    <p className="mt-auto pt-2 text-[0.7rem] text-muted-foreground">
                      ab {numberFormat.format(LEVEL_THRESHOLDS[l - 1])} XP
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
