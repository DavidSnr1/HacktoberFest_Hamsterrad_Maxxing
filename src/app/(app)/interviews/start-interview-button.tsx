"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import type { CreateInterviewResponse } from "@/app/api/interviews/route";
import { useConsentGate } from "@/components/consent/use-consent-gate";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api";
import type { InterviewTrack } from "@/lib/interview/tracks";

type StartInterviewButtonProps = {
  track: InterviewTrack;
  voiceConsentGranted: boolean;
};

/** Asks for voice consent if needed, creates the interview and opens the room. */
export function StartInterviewButton({ track, voiceConsentGranted }: StartInterviewButtonProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { requireConsent, consentDialog } = useConsentGate("voice", voiceConsentGranted);

  async function createInterview() {
    setCreating(true);
    try {
      const response = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        toast.error(body?.error ?? "Das Interview konnte nicht gestartet werden.");
        setCreating(false);
        return;
      }
      const { id } = (await response.json()) as CreateInterviewResponse;
      router.push(`/interviews/${id}`);
    } catch {
      toast.error("Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.");
      setCreating(false);
    }
  }

  return (
    <>
      <Button
        size="lg"
        className="h-10 w-full"
        disabled={creating}
        onClick={() => requireConsent(createInterview)}
      >
        {creating && <Loader2Icon className="animate-spin" aria-hidden />}
        {creating ? "Interview wird vorbereitet …" : "Interview starten"}
      </Button>
      {consentDialog}
    </>
  );
}
