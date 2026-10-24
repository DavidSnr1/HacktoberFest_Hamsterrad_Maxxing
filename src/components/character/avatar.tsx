import type { CSSProperties } from "react";
import type { Level } from "@/lib/gamification/levels";
import { PERSONAS, type Vibe } from "@/lib/gamification/personas";
import { cn } from "@/lib/utils";
import { AVATAR_LOOKS, type AvatarItem } from "./avatar-looks";
import "./avatar.css";

const WIDTH = 230;
const HEIGHT = 348;

const HAIR_CLASSES: Record<Level, string> = {
  1: "av-hair1",
  2: "av-hair2",
  3: "av-hair3",
  4: "av-hair4",
  5: "av-hair5",
};

/** Props drawn as standalone shapes; cuffs, waistcoat, tie pin and lanyard are part of the outfit. */
const ITEM_CLASSES: Partial<Record<AvatarItem, string>> = {
  glasses: "av-glasses",
  coffee: "av-coffee",
  laptop: "av-laptop",
  bottle: "av-bottle",
  racket: "av-racket",
  paddle: "av-paddle",
  briefcase: "av-briefcase",
  notebook: "av-notebook",
  watch: "av-watch",
};

type AvatarProps = {
  vibe: Vibe;
  level: Level;
  /** Scale of the 230x348 px drawing. */
  scale?: number;
  /** Gentle floating motion (off with reduced motion). */
  animated?: boolean;
  /** Plays the level-up pulse. */
  celebrating?: boolean;
  /** Decorative copies (e.g. in the persona gallery) are hidden from screen readers. */
  decorative?: boolean;
  className?: string;
};

/** Cartoon avatar whose outfit and props follow the vibe and level. */
export function Avatar({ vibe, level, scale = 1, animated, celebrating, decorative, className }: AvatarProps) {
  const look = AVATAR_LOOKS[vibe][level];
  const has = (item: AvatarItem) => look.items.includes(item);
  const colors = {
    "--skin": "#d49b76",
    "--hair": look.hairColor ?? "#463129",
    "--shirt": "#f3f1eb",
    "--jacket": look.jacket,
    "--pants": look.pants,
    "--tie": look.tie ?? "transparent",
    "--cuff": look.cuffColor ?? "#627d9d",
    "--vest": "#23334a",
    ...(look.noJacket ? { "--sleeve": "#f4f1eb" } : {}),
  } as CSSProperties;

  return (
    <div
      className={cn("av-frame", className)}
      style={{ width: WIDTH * scale, height: HEIGHT * scale }}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": `Dein Avatar: ${PERSONAS[vibe][level].title}, Level ${level}` })}
    >
      <div
        className={cn("av-figure", animated && "av-float", celebrating && "av-level-up")}
        style={{ ...colors, transform: `scale(${scale})` }}
      >
        <div className="av-head">
          <div className={cn("av-hair", HAIR_CLASSES[level])} />
          <div className="av-eye" />
          <div className="av-nose" />
          <div className="av-mouth" />
        </div>
        <div className="av-neck" />
        <div className="av-arms">
          <div className="av-arm">
            <div className="av-hand" />
          </div>
          <div className={cn("av-arm", "av-arm-right")}>
            <div className="av-hand" />
          </div>
        </div>
        <div className="av-body">
          {look.hoodie && <div className="av-hood" />}
          <div className="av-shirt" />
          {!look.noJacket && <div className={cn("av-jacket", look.hoodie && "av-hoodie")} />}
          {!look.noJacket && !look.hoodie && (
            <>
              <div className="av-lapel" />
              <div className={cn("av-lapel", "av-lapel-right")} />
            </>
          )}
          {has("waistcoat") && <div className="av-waistcoat" />}
          {look.tie && <div className={cn("av-tie", look.tieShort && "av-tie-short")} />}
          {has("tiePin") && <div className="av-tie-pin" />}
          {has("lanyard") && (
            <>
              <div className="av-lanyard" />
              <div className="av-lanyard-card" />
            </>
          )}
        </div>
        {has("cuffs") && (
          <>
            <div className={cn("av-cuff", "av-cuff-left")} />
            <div className={cn("av-cuff", "av-cuff-right")} />
          </>
        )}
        <div className="av-legs">
          <div className="av-leg">
            <div className="av-shoe" />
          </div>
          <div className="av-leg">
            <div className="av-shoe" />
          </div>
        </div>
        {look.items.map((item) => {
          const itemClass = ITEM_CLASSES[item];
          if (!itemClass) return null;
          return (
            <div key={item} className={cn("av-item", itemClass)}>
              {item === "bottle" && <span className="av-bottle-label" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
