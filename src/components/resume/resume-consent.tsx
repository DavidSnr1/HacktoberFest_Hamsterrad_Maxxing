"use client";

import { useConsentGate } from "@/components/consent/use-consent-gate";

/**
 * Single place where this feature touches the shared consent UI.
 * `initiallyGranted` comes from `hasConsent("resume")` on the server; render
 * `consentDialog` and wrap actions that send profile data to Gemma in `requireConsent`.
 */
export function useResumeConsent(initiallyGranted: boolean) {
  return useConsentGate("resume", initiallyGranted);
}
