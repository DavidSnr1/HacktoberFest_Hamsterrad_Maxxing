// LinkedIn, Indeed and StepStone: decided on 2026-10-24 that these adapters are allowed and on by
// default (TEAM-KONTEXT 4C). JOBS_ENABLE_SCRAPED_SOURCES=false switches them off.
export function scrapedSourcesEnabled(): boolean {
  return process.env.JOBS_ENABLE_SCRAPED_SOURCES !== "false";
}

// Indeed blocks almost every request; decided on 2026-10-24 to show example postings instead.
// JOBS_INDEED_MOCK=false reports Indeed as unavailable again.
export function indeedMockEnabled(): boolean {
  return process.env.JOBS_INDEED_MOCK !== "false";
}
