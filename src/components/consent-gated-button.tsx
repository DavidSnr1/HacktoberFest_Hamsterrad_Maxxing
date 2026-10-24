"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConsentGate } from "@/components/consent/use-consent-gate";
import type { ConsentType } from "@/lib/consent/policy";

type ConsentGatedButtonProps = {
  consentType: ConsentType;
  initiallyGranted: boolean;
  children: ReactNode;
  /** Shown after consent while the real feature is not built yet. */
  comingSoonMessage: string;
};

/**
 * Placeholder entry point for features that need consent first.
 * Later steps replace the toast with the real feature (interview, upload).
 */
export function ConsentGatedButton({
  consentType,
  initiallyGranted,
  children,
  comingSoonMessage,
}: ConsentGatedButtonProps) {
  const { requireConsent, consentDialog } = useConsentGate(consentType, initiallyGranted);

  return (
    <>
      <Button size="lg" className="h-10 px-4" onClick={() => requireConsent(() => toast.info(comingSoonMessage))}>
        {children}
      </Button>
      {consentDialog}
    </>
  );
}
