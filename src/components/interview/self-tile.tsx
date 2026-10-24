"use client";

import { useEffect, useRef } from "react";
import { MicOffIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioLevel } from "./use-audio-level";

type SelfTileProps = {
  cameraStream: MediaStream | null;
  isMuted: boolean;
  active: boolean;
  getInputVolume: () => number;
  className?: string;
};

/** Small self view: local camera preview (never sent anywhere) or a mic level badge. */
export function SelfTile({ cameraStream, isMuted, active, getInputVolume, className }: SelfTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const levelRef = useAudioLevel<HTMLDivElement>(getInputVolume, active && !isMuted);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = cameraStream;
  }, [cameraStream]);

  return (
    <div
      ref={levelRef}
      className={cn(
        "relative overflow-hidden rounded-xl bg-neutral-700 shadow-lg ring-1 ring-white/10 [--level:0]",
        className,
      )}
    >
      {cameraStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="size-full -scale-x-100 object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <span
            className="flex size-12 items-center justify-center rounded-full bg-neutral-500 text-sm font-semibold text-white transition-shadow duration-75"
            style={{ boxShadow: "0 0 0 calc(var(--level) * 10px) rgb(52 211 153 / 0.6)" }}
          >
            Du
          </span>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-xs text-white">
        {isMuted && <MicOffIcon className="size-3" aria-label="Stummgeschaltet" />}
        Du
      </div>
    </div>
  );
}
