import { SignOutButton } from "@/components/sign-out-button";
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
      <SignOutButton />
    </div>
  );
}
