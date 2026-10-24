-- Candidate profile: shared data basis for all features (one row per user).
-- data follows src/lib/schemas/candidate-profile.ts. A missing row means an
-- empty profile, so there is no default JSON here (single source of truth: Zod).
--
-- Access: users may only read their row. All writes go through the server
-- (service role) after Zod validation and merging, so nobody can store
-- invalid data or mark values as "taken from the resume" via the API.
-- version enables optimistic locking for concurrent writers.

create table public.candidate_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  version integer not null default 0 check (version >= 0),
  onboarding_completed_at timestamptz,
  onboarding_skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table public.candidate_profiles from anon, authenticated;
grant select on table public.candidate_profiles to authenticated;

alter table public.candidate_profiles enable row level security;

create policy "candidate_profiles_select_own" on public.candidate_profiles
  for select to authenticated using (user_id = (select auth.uid()));
