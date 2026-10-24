"use client";

import { cn } from "@/lib/utils";
import { InterviewerAvatar } from "./interviewer-avatar";
import { useAudioLevel } from "./use-audio-level";

type InterviewerTileProps = {
  name: string;
  role: string;
  isSpeaking: boolean;
  active: boolean;
  getOutputVolume: () => number;
  className?: string;
};

/** Main video-call tile: interviewer portrait that pulses with the voice level. */
export function InterviewerTile({
  name,
  role,
  isSpeaking,
  active,
  getOutputVolume,
  className,
}: InterviewerTileProps) {
  const levelRef = useAudioLevel<HTMLDivElement>(getOutputVolume, active);

  return (
    <div
      ref={levelRef}
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-2xl bg-neutral-800 [--level:0]",
        className,
      )}
    >
      <div className="relative flex items-center justify-center">
        {/* Voice rings, scaled by the live output level */}
        <span
          aria-hidden
          className="absolute size-40 rounded-full bg-white/10 transition-transform duration-75 sm:size-48"
          style={{ transform: "scale(calc(1 + var(--level) * 0.55))" }}
        />
        <span
          aria-hidden
          className="absolute size-40 rounded-full bg-white/10 transition-transform duration-75 sm:size-48"
          style={{ transform: "scale(calc(1 + var(--level) * 0.3))" }}
        />
        <div
          className={cn(
            "relative size-36 overflow-hidden rounded-full ring-4 transition-[box-shadow] duration-200 sm:size-44",
            isSpeaking ? "ring-emerald-400" : "ring-white/10",
          )}
        >
          <InterviewerAvatar className="size-full" />
        </div>
      </div>

      <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-col rounded-lg bg-black/50 px-3 py-1.5 text-white backdrop-blur">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="truncate text-xs text-white/70">{role}</span>
      </div>
      {active && (
        <div
          className="absolute top-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur"
          aria-live="polite"
        >
          {isSpeaking ? "Spricht …" : "Hört zu"}
        </div>
      )}
    </div>
  );
}
