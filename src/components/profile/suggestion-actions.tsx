"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmSuggestion } from "@/lib/profile/actions";
import type { ProfileTarget } from "@/lib/schemas/candidate-profile";

/** Accept or reject buttons for an unconfirmed (automatically found) profile value. */
export function SuggestionActions({ target }: { target: ProfileTarget }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function decide(accept: boolean) {
    startTransition(async () => {
      try {
        const result = await confirmSuggestion(target, accept);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        router.refresh();
      } catch {
        toast.error("Keine Verbindung zum Server. Bitte versuche es erneut.");
      }
    });
  }

  return (
    <span className="flex shrink-0 gap-1">
      <Button variant="outline" size="icon-sm" onClick={() => decide(true)} disabled={pending} aria-label="Übernehmen">
        <CheckIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => decide(false)} disabled={pending} aria-label="Verwerfen">
        <XIcon />
      </Button>
    </span>
  );
}
