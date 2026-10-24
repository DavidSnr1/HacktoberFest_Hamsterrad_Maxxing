"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { claimMilestone } from "@/lib/gamification/actions";
import type { MilestoneId } from "@/lib/gamification/milestones";

type ClaimMilestoneButtonProps = { id: MilestoneId; title: string; xp: number };

/** Lets the user confirm a milestone the profile cannot hold. Cannot be undone, so it asks first. */
export function ClaimMilestoneButton({ id, title, xp }: ClaimMilestoneButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await claimMilestone(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(`+${xp} XP für „${title}“`);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Geschafft
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Bestätige nur, was du wirklich erreicht hast. Der Meilenstein bringt dir {xp} XP und lässt sich nicht
              zurücknehmen.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Abbrechen
            </Button>
            <Button onClick={confirm} disabled={pending}>
              {pending ? "Wird gespeichert …" : "Bestätigen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
