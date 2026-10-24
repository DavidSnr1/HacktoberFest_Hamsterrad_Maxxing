/**
 * Level curve. Total XP is the sum of all xp_events of a user; the level is
 * derived from it, never stored.
 */

/** XP needed to reach level 1..5 (index 0 = level 1). */
export const LEVEL_THRESHOLDS = [0, 201, 501, 1001, 1801] as const;
export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export type Level = 1 | 2 | 3 | 4 | 5;

export function levelFromXp(xp: number): Level {
  for (let index = LEVEL_THRESHOLDS.length - 1; index >= 0; index -= 1) {
    if (xp >= LEVEL_THRESHOLDS[index]) return (index + 1) as Level;
  }
  return 1;
}

/** XP needed to reach the given level. */
export function xpForLevel(level: Level): number {
  return LEVEL_THRESHOLDS[level - 1];
}

export type LevelProgress = {
  level: Level;
  xp: number;
  /** Start of the current level. */
  levelStartXp: number;
  /** Start of the next level; null at the maximum level. */
  nextLevelXp: number | null;
  /** 0-100 within the current level (100 at the maximum level). */
  percent: number;
};

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const levelStartXp = xpForLevel(level);
  const nextLevelXp = level < MAX_LEVEL ? xpForLevel((level + 1) as Level) : null;
  const percent =
    nextLevelXp === null ? 100 : Math.round(((xp - levelStartXp) / (nextLevelXp - levelStartXp)) * 100);
  return { level, xp, levelStartXp, nextLevelXp, percent };
}
