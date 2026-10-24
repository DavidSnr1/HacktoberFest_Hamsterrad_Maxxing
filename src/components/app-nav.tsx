"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { BriefcaseIcon, FileTextIcon, UserRoundIcon, VideoIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { href: "/character", label: "Charakter", icon: UserRoundIcon },
  { href: "/interviews", label: "Interviews", icon: VideoIcon },
  { href: "/resume", label: "Lebenslauf", icon: FileTextIcon },
  { href: "/jobs", label: "Stellen", icon: BriefcaseIcon },
];

type NavListProps = { active?: string };

function useActiveHref() {
  const pathname = usePathname();
  return TABS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href;
}

/**
 * Reading the pathname is request data. Each nav renders a static version
 * (no active tab) into the prerendered shell and streams in the highlight.
 */
function withActiveHref(List: (props: NavListProps) => React.ReactNode) {
  function Active() {
    return <List active={useActiveHref()} />;
  }
  return function Nav() {
    return (
      <Suspense fallback={<List />}>
        <Active />
      </Suspense>
    );
  };
}

function DesktopNavList({ active }: NavListProps) {
  return (
    <nav aria-label="Hauptnavigation" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {TABS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active === href ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active === href && "bg-muted text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MobileNavList({ active }: NavListProps) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active === href ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors",
                active === href && "text-foreground",
              )}
            >
              <Icon className={cn("size-5", active === href && "stroke-[2.5]")} aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Horizontal tabs in the header, visible from the md breakpoint up. */
export const DesktopNav = withActiveHref(DesktopNavList);

/** Fixed bottom tab bar for phones, hidden from the md breakpoint up. */
export const MobileNav = withActiveHref(MobileNavList);
