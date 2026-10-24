import Image from "next/image";
import type { Level } from "@/lib/gamification/levels";
import { PERSONAS, type Vibe } from "@/lib/gamification/personas";
import { cn } from "@/lib/utils";
import "./avatar.css";

type AvatarProps = {
  vibe: Vibe;
  level: Level;
  /** Image `sizes` hint; the box itself is sized by className. */
  sizes?: string;
  /** Gentle floating motion (off with reduced motion). */
  animated?: boolean;
  /** Plays the level-up pulse. */
  celebrating?: boolean;
  /** Decorative copies (e.g. in the persona gallery) are hidden from screen readers. */
  decorative?: boolean;
  priority?: boolean;
  className?: string;
};

/** Illustrated avatar per vibe and level (2:3 images in public/avatars). Fills its box. */
export function Avatar({ vibe, level, sizes = "240px", animated, celebrating, decorative, priority, className }: AvatarProps) {
  return (
    <div className={cn("relative overflow-hidden", animated && "av-float", celebrating && "av-level-up", className)}>
      <Image
        src={`/avatars/${vibe}-${level}.png`}
        alt={decorative ? "" : `Dein Avatar: ${PERSONAS[vibe][level].title}, Level ${level}`}
        aria-hidden={decorative || undefined}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover object-top"
      />
    </div>
  );
}
