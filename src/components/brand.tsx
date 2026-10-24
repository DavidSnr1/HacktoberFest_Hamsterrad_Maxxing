import { cn } from "@/lib/utils";

/** Wordmark with a highlighter stroke under "Maxxing", drawn for light backgrounds. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("text-lg font-extrabold whitespace-nowrap tracking-[-0.03em] text-foreground", className)}>
      Hamsterrad <span className="highlight">Maxxing</span>
    </span>
  );
}
