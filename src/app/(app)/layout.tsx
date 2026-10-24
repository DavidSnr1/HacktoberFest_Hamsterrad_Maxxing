import Link from "next/link";
import { Suspense } from "react";
import { DesktopNav, MobileNav } from "@/components/app-nav";
import { AuthGuard } from "@/components/auth-guard";
import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";

export default function AppLayout({ children }: LayoutProps<"/">) {
  // The header and tabs are static and prerendered; only the session-dependent
  // parts stream in behind Suspense boundaries.
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-gold/40 bg-navy text-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/interviews" aria-label="Karrierecoach, zur Startseite">
            <Brand />
          </Link>
          <DesktopNav />
          <Suspense fallback={<div className="h-7 w-20" aria-hidden />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-24 md:pt-10 md:pb-12">
        <Suspense fallback={<PageSkeleton />}>
          <AuthGuard>{children}</AuthGuard>
        </Suspense>
      </main>
      <MobileNav />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" role="status" aria-label="Wird geladen">
      <div className="h-7 w-48 rounded-md bg-muted" />
      <div className="h-4 w-72 max-w-full rounded-md bg-muted" />
      <div className="h-56 rounded-xl bg-muted" />
    </div>
  );
}
