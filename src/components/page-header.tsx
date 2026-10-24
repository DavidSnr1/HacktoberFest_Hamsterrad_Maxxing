import type { ReactNode } from "react";
import { TrendLine } from "@/components/trend-line";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  /** Short category label above the title, e.g. "Interviewtraining". */
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

/** Navy title panel on graph paper with a brass trend line: the page's masthead. */
export function PageHeader({ eyebrow, title, description, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "graph-paper relative isolate overflow-hidden rounded-lg bg-navy px-5 py-6 text-white sm:px-8 sm:py-8",
        "[--grid-major:oklch(1_0_0/0.08)] [--grid-minor:oklch(1_0_0/0.035)]",
        className,
      )}
    >
      <TrendLine className="absolute right-0 bottom-0 -z-10 h-3/4 w-2/3 opacity-60 sm:w-1/2 sm:opacity-100" />
      <span
        // Sits on the line's last point: the chart fills the bottom 75%, the point is at y=10/120.
        className="absolute top-[31.25%] right-0 size-2.5 translate-x-[-0.2rem] -translate-y-1/2 rounded-full bg-gold shadow-[0_0_0_4px_oklch(0.76_0.13_80/0.25)] max-sm:hidden"
        aria-hidden
      />
      <div className="flex max-w-2xl flex-col gap-2">
        <p className="flex items-center gap-2 text-[0.7rem] font-semibold tracking-[0.14em] text-gold uppercase">
          <span className="h-px w-6 bg-gold" aria-hidden />
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {description && <div className="text-sm leading-relaxed text-white/75 sm:text-[0.95rem]">{description}</div>}
      </div>
    </header>
  );
}
