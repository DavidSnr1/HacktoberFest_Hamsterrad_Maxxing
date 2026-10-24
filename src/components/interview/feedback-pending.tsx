"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2Icon } from "lucide-react";

const REFRESH_INTERVAL_MS = 5_000;

/**
 * Shown while the feedback is generated in the background. Re-renders the
 * server page every few seconds until the feedback exists or `until` passes,
 * after which the page shows the retry state instead.
 */
export function FeedbackPending({ until }: { until: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
      if (Date.now() > until) clearInterval(timer);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router, until]);

  return (
    <div className="flex gap-3 rounded-xl border p-4" role="status" aria-live="polite">
      <Loader2Icon className="mt-0.5 size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-medium">Deine Auswertung wird erstellt …</p>
        <p className="text-muted-foreground">
          Die KI bewertet dein Interview nach dem Raster. Das dauert meist 1 bis 3 Minuten. Die
          Seite aktualisiert sich von selbst, du kannst sie aber auch schließen und später
          wiederkommen.
        </p>
      </div>
    </div>
  );
}
