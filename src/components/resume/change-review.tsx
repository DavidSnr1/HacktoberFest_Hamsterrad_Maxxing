"use client";

import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ResumeChange } from "@/lib/resume/diff";
import type { ResumeItem } from "@/lib/schemas/resume";

function itemText(item: ResumeItem): string {
  return [item.heading, ...item.bullets.map((b) => `• ${b}`)].join("\n");
}

function describe(change: ResumeChange): { title: string; before?: string; after?: string } {
  switch (change.type) {
    case "summary":
      return { title: "Zusammenfassung", before: change.before || "–", after: change.after || "–" };
    case "section-title":
      return { title: "Abschnittstitel", before: change.before, after: change.after };
    case "section-added":
      return { title: `Neuer Abschnitt „${change.section.title}“`, after: change.section.items.map((i) => i.heading).join(", ") };
    case "section-removed":
      return { title: `Abschnitt „${change.section.title}“ entfernt`, before: change.section.items.map((i) => i.heading).join(", ") };
    case "item-added":
      return { title: `Neu in „${change.sectionTitle}“`, after: itemText(change.item) };
    case "item-removed":
      return { title: `Entfernt aus „${change.sectionTitle}“`, before: itemText(change.item) };
    case "item-modified":
      return { title: `Geändert: ${change.after.heading}`, before: itemText(change.before), after: itemText(change.after) };
    case "item-moved":
      return {
        title: `Verschoben: ${change.after.heading} („${change.fromTitle}“ → „${change.toTitle}“)`,
        before: itemText(change.before),
        after: itemText(change.after),
      };
    case "order":
      return { title: "Reihenfolge der Abschnitte bzw. Stationen geändert" };
  }
}

type Props = {
  changes: ResumeChange[];
  note: string | null;
  onDecide: (acceptedChangeIds: string[]) => Promise<void>;
};

/** Before/after per change; the user picks which ones to keep. */
export function ChangeReview({ changes, note, onDecide }: Props) {
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set(changes.map((c) => c.id)));
  const [pending, setPending] = useState<"accept" | "reject" | null>(null);

  function toggle(id: string, value: boolean) {
    setAccepted((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function decide(kind: "accept" | "reject") {
    setPending(kind);
    try {
      await onDecide(kind === "accept" ? [...accepted] : []);
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="change-review-title" className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div>
        <h2 id="change-review-title" className="font-semibold">
          Vorgeschlagene Änderungen
        </h2>
        {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
      </div>

      <ul className="space-y-2">
        {changes.map((change) => {
          const { title, before, after } = describe(change);
          const checked = accepted.has(change.id);
          return (
            <li key={change.id} className="rounded-md border bg-background p-3">
              <label className="flex items-start gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  onChange={(e) => toggle(change.id, e.target.checked)}
                  disabled={pending !== null}
                />
                <span>{title}</span>
              </label>
              {before !== undefined || after !== undefined ? (
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                  {before !== undefined ? (
                    <div className="rounded bg-red-50 p-2 whitespace-pre-line text-red-900 dark:bg-red-950/40 dark:text-red-200">
                      <span className="sr-only">Vorher: </span>
                      {before}
                    </div>
                  ) : null}
                  {after !== undefined ? (
                    <div className="rounded bg-green-50 p-2 whitespace-pre-line text-green-900 dark:bg-green-950/40 dark:text-green-200">
                      <span className="sr-only">Nachher: </span>
                      {after}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => decide("accept")} disabled={pending !== null || accepted.size === 0}>
          {pending === "accept" ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon aria-hidden />}
          {accepted.size === changes.length ? "Alle übernehmen" : `${accepted.size} von ${changes.length} übernehmen`}
        </Button>
        <Button variant="outline" onClick={() => decide("reject")} disabled={pending !== null}>
          {pending === "reject" ? <Loader2Icon className="animate-spin" aria-hidden /> : <XIcon aria-hidden />}
          Verwerfen
        </Button>
      </div>
    </section>
  );
}
