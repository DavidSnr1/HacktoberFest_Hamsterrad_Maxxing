-- Feature C: cached search results (no personal data) and per-user search log for rate limiting.

create table public.job_search_cache (
  query_hash text primary key,
  posting_ids uuid[] not null default '{}',
  source_status jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.job_search_cache enable row level security;

-- Service role only: no grants and no policies for anon/authenticated.
revoke all on table public.job_search_cache from anon, authenticated;

create table public.job_search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index job_search_events_user_created_idx on public.job_search_events (user_id, created_at desc);

alter table public.job_search_events enable row level security;

revoke all on table public.job_search_events from anon, authenticated;
grant select, insert on table public.job_search_events to authenticated;

create policy "job_search_events_select_own"
  on public.job_search_events for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "job_search_events_insert_own"
  on public.job_search_events for insert
  to authenticated
  with check (user_id = (select auth.uid()));
