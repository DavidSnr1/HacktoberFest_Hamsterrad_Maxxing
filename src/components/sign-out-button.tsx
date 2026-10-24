import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Posts to the sign-out route; works without client-side JavaScript. */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="ghost" size="sm" aria-label="Abmelden" className={className}>
        <LogOutIcon aria-hidden />
        <span className="hidden sm:inline">Abmelden</span>
      </Button>
    </form>
  );
}
