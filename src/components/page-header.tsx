import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  /** Short category label above the title, e.g. "Interviewtraining". */
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

/** Report-style page title: eyebrow with a brass rule, serif headline, lead text. */
export function PageHeader({ eyebrow, title, description, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-2 border-b pb-5", className)}>
      <p className="flex items-center gap-2 text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-gold" aria-hidden />
        {eyebrow}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">{title}</h1>
      {description && (
        <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">{description}</div>
      )}
    </header>
  );
}
