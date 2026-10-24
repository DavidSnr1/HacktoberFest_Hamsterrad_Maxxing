"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveDisplayName } from "@/lib/profile/actions";

const normalize = (name: string) => name.trim().replace(/\s+/g, " ");

/** Edits the name shown at the top of the user's resumes (profiles.display_name). */
export function DisplayNameForm({ initialName }: { initialName: string | null }) {
  const router = useRouter();
  const inputId = useId();
  const [name, setName] = useState(initialName ?? "");
  const [pending, startTransition] = useTransition();
  const changed = normalize(name) !== (initialName ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await saveDisplayName(name);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(normalize(name) ? "Name gespeichert." : "Name entfernt.");
        router.refresh();
      } catch {
        toast.error("Keine Verbindung zum Server. Bitte versuche es erneut.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor={inputId}>Vor- und Nachname</Label>
        <Input
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Lena Becker"
          maxLength={80}
          autoComplete="name"
          disabled={pending}
        />
      </div>
      <Button type="submit" disabled={pending || !changed}>
        {pending && <Loader2Icon className="animate-spin" aria-hidden />}
        Speichern
      </Button>
    </form>
  );
}
