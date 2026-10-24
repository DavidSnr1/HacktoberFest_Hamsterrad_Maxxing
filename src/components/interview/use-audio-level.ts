"use client";

import { useEffect, useRef } from "react";

/**
 * Polls an audio level (0..1) every animation frame and writes it to the
 * element's `--level` CSS variable. Avoids React re-renders at 60 fps.
 */
export function useAudioLevel<T extends HTMLElement>(getLevel: () => number, active: boolean) {
  const ref = useRef<T>(null);
  const getLevelRef = useRef(getLevel);

  useEffect(() => {
    getLevelRef.current = getLevel;
  }, [getLevel]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!active) {
      element.style.setProperty("--level", "0");
      return;
    }

    let frame = 0;
    let smoothed = 0;
    const tick = () => {
      let level = 0;
      try {
        level = getLevelRef.current();
      } catch {
        // The SDK throws briefly while the audio graph is set up or torn down.
      }
      const clamped = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
      // Fast attack, slow release, so the animation looks natural.
      smoothed = clamped > smoothed ? clamped : smoothed * 0.85 + clamped * 0.15;
      element.style.setProperty("--level", smoothed.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return ref;
}
