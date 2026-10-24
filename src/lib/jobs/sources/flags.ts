// LinkedIn, Indeed and StepStone forbid scraping in their terms (see TEAM-KONTEXT 4C).
// These adapters are for local, non-public use only and stay off unless explicitly enabled.
export function scrapedSourcesEnabled(): boolean {
  return process.env.JOBS_ENABLE_SCRAPED_SOURCES === "true";
}
