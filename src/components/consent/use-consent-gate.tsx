"use client";

import { useRef, useState } from "react";
import type { ConsentType } from "@/lib/consent/policy";
import { ConsentDialog } from "./consent-dialog";

/**
 * Runs an action only after the user has given consent.
 * `initiallyGranted` comes from the server (hasConsent). If consent is missing,
 * `requireConsent` opens the dialog and runs the action after agreement.
 */
export function useConsentGate(type: ConsentType, initiallyGranted: boolean) {
  const [granted, setGranted] = useState(initiallyGranted);
  const [open, setOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  function requireConsent(action: () => void) {
    if (granted) {
      action();
      return;
    }
    pendingAction.current = action;
    setOpen(true);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) pendingAction.current = null;
  }

  function handleGranted() {
    setGranted(true);
    setOpen(false);
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  }

  const consentDialog = (
    <ConsentDialog
      type={type}
      open={open}
      onOpenChange={handleOpenChange}
      onGranted={handleGranted}
    />
  );

  return { granted, requireConsent, consentDialog };
}
