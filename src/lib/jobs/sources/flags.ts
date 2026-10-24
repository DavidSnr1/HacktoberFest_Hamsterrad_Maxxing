// LinkedIn, Indeed and StepStone: decided on 2026-10-24 that these adapters are allowed and on by
// default (TEAM-KONTEXT 4C). JOBS_ENABLE_SCRAPED_SOURCES=false switches them off.
export function scrapedSourcesEnabled(): boolean {
  return process.env.JOBS_ENABLE_SCRAPED_SOURCES !== "false";
}

// Indeed blocks almost every request; decided on 2026-10-24 to show example postings instead and to
// top up result lists to 10. JOBS_INDEED_MOCK=false turns both off and reports Indeed as unavailable.
export function indeedMockEnabled(): boolean {
  return process.env.JOBS_INDEED_MOCK !== "false";
}

// Presentation mode, decided on 2026-10-24: the app is shown as a demo, not live. Example postings
// then look like ordinary Indeed results. Never enable this for real users.
export function jobsDemoMode(): boolean {
  return process.env.JOBS_DEMO_MODE === "true";
}
