import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

/** Large left-aligned page title on paper, with an optional one-paragraph intro. */
export function PageHeader({ title, description, className }: PageHeaderProps) {
  return (
    <header className={cn("flex max-w-2xl flex-col gap-3 pt-2", className)}>
      <h1 className="text-4xl leading-[1.05] font-extrabold tracking-[-0.035em] sm:text-5xl">{title}</h1>
      {description && <div className="max-w-[62ch] text-base leading-relaxed text-muted-foreground">{description}</div>}
    </header>
  );
}
