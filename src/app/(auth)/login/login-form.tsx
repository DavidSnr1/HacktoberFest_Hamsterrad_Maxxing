"use client";

import { useState, type FormEvent } from "react";
import { Loader2Icon, MailCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

function errorMessageFor(status: number | undefined) {
  if (status === 429) {
    return "Zu viele Anfragen. Bitte warte kurz und versuche es erneut.";
  }
  // No status or 5xx: network problem or the auth service is down.
  if (!status || status >= 500) {
    return "Der Anmeldedienst ist gerade nicht erreichbar. Bitte versuche es später erneut.";
  }
  return "Der Link konnte nicht gesendet werden. Bitte prüfe deine E-Mail-Adresse und versuche es erneut.";
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      setStatus({ kind: "error", message: "Supabase ist nicht konfiguriert." });
      return;
    }

    setStatus({ kind: "sending" });
    const trimmed = email.trim();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setStatus({ kind: "error", message: errorMessageFor(error.status) });
      return;
    }
    setStatus({ kind: "sent", email: trimmed });
  }

  if (status.kind === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 text-center" role="status">
        <MailCheckIcon className="size-10 text-primary" aria-hidden />
        <p className="font-medium">Prüfe dein Postfach</p>
        <p className="text-sm text-muted-foreground">
          Wir haben einen Anmelde-Link an <strong>{status.email}</strong> gesendet.
          Klicke auf den Link, um dich anzumelden.
        </p>
        <Button variant="ghost" onClick={() => setStatus({ kind: "idle" })}>
          Andere E-Mail-Adresse verwenden
        </Button>
      </div>
    );
  }

  const sending = status.kind === "sending";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="name@beispiel.de"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={sending}
          aria-invalid={status.kind === "error"}
          className="h-10"
        />
      </div>
      {status.kind === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {status.message}
        </p>
      )}
      <Button type="submit" size="lg" className="h-10" disabled={sending}>
        {sending && <Loader2Icon className="animate-spin" aria-hidden />}
        {sending ? "Link wird gesendet …" : "Anmelde-Link senden"}
      </Button>
    </form>
  );
}
