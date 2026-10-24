-- Feature C: extra posting facts and cached application outlook estimates. No personal data.

-- Search results and detail pages are stored in separate columns so a new search never
-- overwrites the full description or facts that were loaded from the detail page.
alter table public.job_postings
  add column snippet text not null default '',
  add column insights jsonb not null default '{}'::jsonb,
  add column detail_insights jsonb not null default '{}'::jsonb,
  add column details_fetched_at timestamptz;

-- Estimated application timing/competition per company + role type, shared by all users.
create table public.job_outlook_cache (
  cache_key text primary key,
  outlook jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.job_outlook_cache enable row level security;

-- Service role only: no grants and no policies for anon/authenticated.
revoke all on table public.job_outlook_cache from anon, authenticated;
