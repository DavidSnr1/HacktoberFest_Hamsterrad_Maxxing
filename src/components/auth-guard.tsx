import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { needsOnboarding } from "@/lib/profile/server";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Renders children only for a signed-in user. This is the authoritative check;
 * the proxy redirect before it is only optimistic. Must sit inside <Suspense>.
 */
export async function AuthGuard({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // First visit: collect the profile in the onboarding chat (can be skipped there).
  if (await needsOnboarding()) redirect("/onboarding");
  return children;
}
