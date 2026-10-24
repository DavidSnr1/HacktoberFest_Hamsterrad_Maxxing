import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Local-only direct sign-in (next dev + DEV_LOGIN_EMAILS); skips the magic-link email. */
export function DevLoginForm() {
  return (
    <form action="/auth/dev-login" method="post" className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <p className="text-xs font-medium text-muted-foreground">Nur lokal: ohne E-Mail anmelden</p>
      <div className="flex gap-2">
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="deine@mail.de"
          aria-label="E-Mail für die Direktanmeldung"
        />
        <Button type="submit" variant="outline">
          Direkt anmelden
        </Button>
      </div>
    </form>
  );
}
