import Link from "next/link";
import { UserRoundCogIcon } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/server";

/** Ghost buttons in the navy header. */
const ON_NAVY = "text-white/80 hover:bg-white/10 hover:text-white";

/** Signed-in user's email and the sign-out button. Must sit inside <Suspense>. */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      {user.email && (
        <span className="hidden max-w-48 truncate text-sm text-white/60 lg:inline">
          {user.email}
        </span>
      )}
      <Link
        href="/profile"
        className={buttonVariants({ variant: "ghost", size: "sm", className: ON_NAVY })}
        aria-label="Mein Profil"
      >
        <UserRoundCogIcon aria-hidden />
        <span className="hidden sm:inline">Mein Profil</span>
      </Link>
      <SignOutButton className={ON_NAVY} />
    </div>
  );
}
