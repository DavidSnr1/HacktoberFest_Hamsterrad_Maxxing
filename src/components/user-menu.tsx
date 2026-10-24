import Link from "next/link";
import { UserRoundCogIcon } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/server";

/** Signed-in user's email and the sign-out button. Must sit inside <Suspense>. */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      {user.email && (
        <span className="hidden max-w-48 truncate text-sm text-muted-foreground lg:inline">
          {user.email}
        </span>
      )}
      <Link href="/profile" className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label="Mein Profil">
        <UserRoundCogIcon aria-hidden />
        <span className="hidden sm:inline">Mein Profil</span>
      </Link>
      <SignOutButton />
    </div>
  );
}
