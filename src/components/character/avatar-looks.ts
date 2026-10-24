import type { Level } from "@/lib/gamification/levels";
import type { Vibe } from "@/lib/gamification/personas";

export type AvatarItem =
  | "glasses"
  | "coffee"
  | "laptop"
  | "bottle"
  | "racket"
  | "paddle"
  | "briefcase"
  | "notebook"
  | "watch"
  | "tiePin"
  | "lanyard"
  | "cuffs"
  | "waistcoat";

export type AvatarLook = {
  jacket: string;
  pants: string;
  /** Tie color; null = no tie. */
  tie: string | null;
  tieShort?: boolean;
  /** Shirt sleeves instead of a jacket. */
  noJacket?: boolean;
  /** Hoodie cut with hood, no lapels. */
  hoodie?: boolean;
  hairColor?: string;
  cuffColor?: string;
  items: AvatarItem[];
};

const SHIRT = "#f4f1eb";

/** Outfit and props per vibe and level, taken from the NextStep prototype. */
export const AVATAR_LOOKS: Record<Vibe, Record<Level, AvatarLook>> = {
  consulting: {
    1: { jacket: "#77787f", pants: "#383a41", tie: "#8b8d91", tieShort: true, items: ["notebook"] },
    2: { jacket: "#696a73", pants: "#383a41", tie: "#627d9d", items: ["bottle", "laptop"] },
    3: { jacket: "#696a73", pants: "#383a41", tie: "#627d9d", cuffColor: SHIRT, items: ["laptop", "glasses", "cuffs"] },
    4: { jacket: "#4f525c", pants: "#383a41", tie: "#627d9d", items: ["laptop", "glasses", "lanyard"] },
    5: { jacket: "#343844", pants: "#2c2e35", tie: "#627d9d", items: ["laptop", "glasses", "tiePin"] },
  },
  finance: {
    1: { jacket: SHIRT, pants: "#272f3b", tie: "#a44743", noJacket: true, items: ["notebook"] },
    2: { jacket: "#182a40", pants: "#272f3b", tie: "#a44743", items: ["waistcoat", "watch"] },
    3: { jacket: "#24374c", pants: "#272f3b", tie: "#a44743", items: ["watch", "laptop", "coffee", "glasses"] },
    4: { jacket: "#1b2d42", pants: "#222a35", tie: "#a44743", items: ["watch", "briefcase", "coffee", "glasses"] },
    5: { jacket: "#111e31", pants: "#1c2430", tie: "#a44743", items: ["watch", "briefcase", "coffee", "glasses", "tiePin"] },
  },
  startup: {
    1: { jacket: "#55765a", pants: "#414840", tie: null, hoodie: true, items: ["laptop"] },
    2: { jacket: "#435f49", pants: "#414840", tie: null, hoodie: true, items: ["laptop", "racket", "paddle"] },
    3: { jacket: "#6e886d", pants: "#414840", tie: null, items: ["laptop"] },
    4: { jacket: "#344c3c", pants: "#3a4039", tie: null, items: ["lanyard"] },
    5: { jacket: "#243b2d", pants: "#33392f", tie: null, hairColor: "#292b2a", items: ["briefcase", "watch"] },
  },
};
