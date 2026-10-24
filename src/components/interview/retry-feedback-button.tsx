"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api";

/** Requests feedback generation again and reloads the page when done. */
export function RetryFeedbackButton({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/interviews/${interviewId}/feedback`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        setError(body?.error ?? "Die Auswertung konnte nicht erstellt werden.");
        return;
      }
      router.refresh();
    } catch {
      setError("Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={retry} disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <RefreshCwIcon aria-hidden />}
        {pending ? "Auswertung wird erstellt … (ca. 30 Sekunden)" : "Auswertung erstellen"}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
