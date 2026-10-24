"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { InterviewerAvatar } from "./interviewer-avatar";
import { useAudioLevel } from "./use-audio-level";

type InterviewerTileProps = {
  name: string;
  role: string;
  isSpeaking: boolean;
  /** Talking-head clip of the current line (muted, synced to the voice); null shows the avatar. */
  videoUrl?: string | null;
  active: boolean;
  getOutputVolume: () => number;
  className?: string;
};

/**
 * Main video-call tile: the interviewer's talking-head video if there is one
 * for the current line, otherwise a portrait that pulses with the voice level.
 */
export function InterviewerTile({
  name,
  role,
  isSpeaking,
  videoUrl,
  active,
  getOutputVolume,
  className,
}: InterviewerTileProps) {
  const levelRef = useAudioLevel<HTMLDivElement>(getOutputVolume, active && !videoUrl);
  const videoRef = useRef<HTMLVideoElement>(null);

  // The voice comes from the audio engine; the video only follows it.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isSpeaking) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isSpeaking, videoUrl]);

  return (
    <div
      ref={levelRef}
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-2xl bg-neutral-800 [--level:0]",
        className,
      )}
    >
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          preload="auto"
          aria-label={`Video von ${name}`}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
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
      )}

      <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-col rounded-lg bg-black/50 px-3 py-1.5 text-white backdrop-blur">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="truncate text-xs text-white/70">{role}</span>
        {/* Transparency for AI-generated video (EU AI Act) */}
        {videoUrl && <span className="text-[11px] text-white/60">KI-generiertes Video</span>}
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
