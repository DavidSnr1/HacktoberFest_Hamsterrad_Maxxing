import { useId } from "react";
import { cn } from "@/lib/utils";

// A rising price line, drawn in a 400×120 box (the brand's "upward trend" motif).
const TREND = "0,96 40,90 70,98 110,74 150,80 190,58 225,66 265,40 300,48 340,24 370,30 400,10";

/** Decorative brass trend line with a soft area fill; stretch it with className. */
export function TrendLine({ className }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="none" className={cn("pointer-events-none", className)} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--gold)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${TREND} 400,120 0,120`} fill={`url(#${gradientId})`} />
      <polyline
        points={TREND}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}
