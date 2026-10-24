"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileTextIcon, UserRoundIcon, VideoIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { href: "/character", label: "Charakter", icon: UserRoundIcon },
  { href: "/interviews", label: "Interviews", icon: VideoIcon },
  { href: "/resume", label: "Lebenslauf", icon: FileTextIcon },
];

function useActiveHref() {
  const pathname = usePathname();
  return TABS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href;
}

/** Horizontal tabs in the header, visible from the md breakpoint up. */
export function DesktopNav() {
  const active = useActiveHref();
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

/** Fixed bottom tab bar for phones, hidden from the md breakpoint up. */
export function MobileNav() {
  const active = useActiveHref();
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-3">
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
