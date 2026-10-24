"use client";

import { useId, useState, useTransition } from "react";
import { Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { grantConsent } from "@/lib/consent/actions";
import { CONSENT_TEXTS, type ConsentType } from "@/lib/consent/policy";

type ConsentDialogProps = {
  type: ConsentType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGranted: () => void;
};

/** Asks for GDPR consent and stores it. Calls onGranted once it is saved. */
export function ConsentDialog({ type, open, onOpenChange, onGranted }: ConsentDialogProps) {
  const text = CONSENT_TEXTS[type];
  const checkboxId = useId();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (!next) {
      setChecked(false);
      setError(null);
    }
    onOpenChange(next);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await grantConsent(type);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setChecked(false);
        onGranted();
      } catch {
        setError("Keine Verbindung zum Server. Bitte versuche es erneut.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
            <ShieldCheckIcon className="size-5" aria-hidden />
          </div>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{text.intro}</DialogDescription>
        </DialogHeader>

        <ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
          {text.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <div className="flex items-start gap-3 rounded-lg border p-3">
          <Checkbox
            id={checkboxId}
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
            disabled={pending}
            className="mt-0.5"
          />
          <Label htmlFor={checkboxId} className="leading-snug font-normal">
            {text.checkboxLabel}
          </Label>
        </div>

        {error && (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} disabled={!checked || pending}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            {text.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
