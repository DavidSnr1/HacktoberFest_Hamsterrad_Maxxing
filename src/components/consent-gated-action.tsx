import { Suspense, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConsentGatedButton } from "@/components/consent-gated-button";
import { hasConsent } from "@/lib/consent/server";
import type { ConsentType } from "@/lib/consent/policy";

type ConsentGatedActionProps = {
  consentType: ConsentType;
  comingSoonMessage: string;
  children: ReactNode;
};

/**
 * Loads the consent status behind its own Suspense boundary, so the rest of
 * the page renders instantly and only the button waits for the database.
 */
export function ConsentGatedAction(props: ConsentGatedActionProps) {
  return (
    <Suspense
      fallback={
        <Button size="lg" className="h-10 px-4" disabled>
          {props.children}
        </Button>
      }
    >
      <ConsentGatedActionInner {...props} />
    </Suspense>
  );
}

async function ConsentGatedActionInner({
  consentType,
  comingSoonMessage,
  children,
}: ConsentGatedActionProps) {
  const granted = await hasConsent(consentType);
  return (
    <ConsentGatedButton
      consentType={consentType}
      initiallyGranted={granted}
      comingSoonMessage={comingSoonMessage}
    >
      {children}
    </ConsentGatedButton>
  );
}
