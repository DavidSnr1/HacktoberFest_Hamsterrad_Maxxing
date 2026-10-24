import "server-only";

import { adzunaSource } from "./adzuna";
import { arbeitnowSource } from "./arbeitnow";
import { arbeitsagenturSource } from "./arbeitsagentur";
import { indeedSource } from "./indeed";
import { linkedinSource } from "./linkedin";
import { stepstoneSource } from "./stepstone";
import type { JobSource } from "./types";

// New source = new file in this folder + one entry here.
export const JOB_SOURCES: JobSource[] = [
  arbeitsagenturSource,
  arbeitnowSource,
  adzunaSource,
  stepstoneSource,
  linkedinSource,
  indeedSource,
];

export function getEnabledSources(): JobSource[] {
  return JOB_SOURCES.filter((source) => source.isEnabled());
}

export function getSource(id: string): JobSource | undefined {
  return JOB_SOURCES.find((source) => source.id === id);
}
