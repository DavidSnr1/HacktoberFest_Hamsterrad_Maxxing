"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

/** After this long the quality model is slower than usual (llm.ts may be retrying or falling back). */
const SLOW_AFTER_SECONDS = 120;

/**
 * Waiting notice for the slow resume calls (create, rebuild, revise). Gemma
 * takes one to two minutes; the running time shows that it is still working.
 */
export function LlmProgress({ text }: { text: string }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
        <span>
          Läuft seit <span className="tabular-nums">{elapsed}</span>
        </span>
      </p>
      <p className="text-muted-foreground" aria-live="polite">
        {text} Das dauert meist ein bis zwei Minuten, bitte lass die Seite so lange geöffnet.
      </p>
      {seconds >= SLOW_AFTER_SECONDS ? (
        <p className="text-muted-foreground" aria-live="polite">
          Gerade dauert es länger als sonst. Wir versuchen es automatisch weiter.
        </p>
      ) : null}
    </div>
  );
}
