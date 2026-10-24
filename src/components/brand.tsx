import { cn } from "@/lib/utils";

/** Monogram plus wordmark, drawn for a navy background. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        className="flex size-7 items-center justify-center rounded-sm border border-gold/80 font-heading text-base leading-none font-semibold text-gold"
        aria-hidden
      >
        K
      </span>
      <span className="font-heading text-lg font-semibold tracking-tight">Karrierecoach</span>
    </span>
  );
}
