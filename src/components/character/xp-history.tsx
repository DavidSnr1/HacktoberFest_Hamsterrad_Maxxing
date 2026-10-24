import type { XpEvent } from "@/lib/gamification/server";
import { xpEventLabel } from "@/lib/gamification/xp-labels";

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" });

export function XpHistory({ events }: { events: XpEvent[] }) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="history-title">
      <h2 id="history-title" className="text-xl font-semibold tracking-tight">
        Zuletzt gesammelt
      </h2>
      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Noch keine XP. Starte mit einem Mock-Interview oder trag deine Stationen im Profil ein.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {events.map((event, index) => (
            <li key={`${event.createdAt}-${index}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="flex-1">{xpEventLabel(event.type, event.refId)}</span>
              <span className="text-xs text-muted-foreground">{dateFormat.format(new Date(event.createdAt))}</span>
              <span className="w-16 text-right font-semibold tabular-nums">+{event.amount} XP</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
