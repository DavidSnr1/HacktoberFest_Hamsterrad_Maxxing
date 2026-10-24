-- Feature C: public job postings cache. No personal data, no user_id.
-- Written only by the server with the service role; signed-in users may read.

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text not null,
  source_url text not null,
  title text not null,
  company text,
  location text,
  track text check (track in ('startup', 'consulting', 'finance')),
  employment_type text check (employment_type in ('internship', 'working_student', 'entry', 'other')),
  description text not null default '',
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  constraint job_postings_source_unique unique (source, source_id)
);

create index job_postings_fetched_at_idx on public.job_postings (fetched_at);

alter table public.job_postings enable row level security;

revoke all on table public.job_postings from anon, authenticated;
grant select on table public.job_postings to authenticated;

create policy "job_postings_select_authenticated"
  on public.job_postings for select
  to authenticated
  using (true);
