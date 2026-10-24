-- Initial schema: all user data tables with Row Level Security.
--
-- Access model:
--   * Every table is scoped to auth.uid(); users only ever see their own rows.
--   * Rows that award XP or contain AI feedback (xp_events, interview_feedback)
--     are read-only for users. Only the server (service role, bypasses RLS)
--     writes them, so XP cannot be faked from the browser.
--   * Users may delete their own rows ("Meine Daten löschen"). Deleting the
--     auth user cascades through all tables.

-- ---------------------------------------------------------------------------
-- Enums (generate precise TypeScript union types)
-- ---------------------------------------------------------------------------
create type public.interview_track as enum ('startup', 'consulting', 'finance');
create type public.interview_status as enum ('running', 'finished', 'aborted');
create type public.xp_event_type as enum (
  'interview_finished',
  'feedback_score',
  'resume_uploaded',
  'resume_tailored',
  'experience_recorded',
  'daily_streak'
);
create type public.consent_type as enum ('voice', 'resume');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

-- Create a profile automatically for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- interviews
-- ---------------------------------------------------------------------------
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  track public.interview_track not null,
  status public.interview_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  duration_seconds integer check (duration_seconds >= 0),
  check (finished_at is null or finished_at >= started_at)
);

create index interviews_user_id_started_at_idx on public.interviews (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- interview_feedback (one per interview, written by the server only)
-- ---------------------------------------------------------------------------
create table public.interview_feedback (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references public.interviews (id) on delete cascade,
  scores jsonb not null,
  strengths text[] not null default '{}',
  improvements text[] not null default '{}',
  summary text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- resumes
-- ---------------------------------------------------------------------------
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  original_text text not null,
  parsed jsonb,
  created_at timestamptz not null default now()
);

create index resumes_user_id_created_at_idx on public.resumes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- experiences (spoken experiences: transcript + structured result)
-- ---------------------------------------------------------------------------
create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  raw_transcript text not null,
  structured jsonb,
  created_at timestamptz not null default now()
);

create index experiences_user_id_created_at_idx on public.experiences (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- tailored_resumes
-- ---------------------------------------------------------------------------
create table public.tailored_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  job_posting_text text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index tailored_resumes_user_id_created_at_idx on public.tailored_resumes (user_id, created_at desc);
create index tailored_resumes_resume_id_idx on public.tailored_resumes (resume_id);

-- ---------------------------------------------------------------------------
-- xp_events (source of truth for XP and level; written by the server only)
-- ---------------------------------------------------------------------------
create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.xp_event_type not null,
  amount integer not null check (amount > 0),
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index xp_events_user_id_created_at_idx on public.xp_events (user_id, created_at desc);
-- At most one XP event per type and referenced item (e.g. per interview).
create unique index xp_events_user_type_ref_key on public.xp_events (user_id, type, ref_id)
  where ref_id is not null;

-- ---------------------------------------------------------------------------
-- consents (GDPR: voice recordings and resume uploads)
-- ---------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type public.consent_type not null,
  -- Version of the consent text the user agreed to, so we can ask again if it changes.
  policy_version text not null,
  granted_at timestamptz not null default now(),
  unique (user_id, type)
);

-- ---------------------------------------------------------------------------
-- Privileges: Supabase grants everything to anon/authenticated by default.
-- Reset that, give anon nothing and authenticated only what it needs;
-- RLS then restricts which rows are visible.
-- ---------------------------------------------------------------------------
revoke all on
  public.profiles, public.interviews, public.interview_feedback, public.resumes,
  public.experiences, public.tailored_resumes, public.xp_events, public.consents
from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on
  public.interviews, public.resumes, public.experiences, public.tailored_resumes, public.consents
to authenticated;
grant select on public.interview_feedback, public.xp_events to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- (select auth.uid()) is evaluated once per query instead of once per row.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.interviews enable row level security;
alter table public.interview_feedback enable row level security;
alter table public.resumes enable row level security;
alter table public.experiences enable row level security;
alter table public.tailored_resumes enable row level security;
alter table public.xp_events enable row level security;
alter table public.consents enable row level security;

-- profiles: read and edit own profile (created by trigger, deleted with the user)
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- interviews
create policy "interviews_select_own" on public.interviews
  for select to authenticated using (user_id = (select auth.uid()));
create policy "interviews_insert_own" on public.interviews
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "interviews_update_own" on public.interviews
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "interviews_delete_own" on public.interviews
  for delete to authenticated using (user_id = (select auth.uid()));

-- interview_feedback: read-only, via the owning interview
create policy "interview_feedback_select_own" on public.interview_feedback
  for select to authenticated using (
    exists (
      select 1 from public.interviews i
      where i.id = interview_feedback.interview_id
        and i.user_id = (select auth.uid())
    )
  );

-- resumes
create policy "resumes_select_own" on public.resumes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "resumes_insert_own" on public.resumes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "resumes_update_own" on public.resumes
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "resumes_delete_own" on public.resumes
  for delete to authenticated using (user_id = (select auth.uid()));

-- experiences
create policy "experiences_select_own" on public.experiences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "experiences_insert_own" on public.experiences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "experiences_update_own" on public.experiences
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "experiences_delete_own" on public.experiences
  for delete to authenticated using (user_id = (select auth.uid()));

-- tailored_resumes: the referenced resume must belong to the same user
create policy "tailored_resumes_select_own" on public.tailored_resumes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "tailored_resumes_insert_own" on public.tailored_resumes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (
      resume_id is null
      or exists (
        select 1 from public.resumes r
        where r.id = tailored_resumes.resume_id and r.user_id = (select auth.uid())
      )
    )
  );
create policy "tailored_resumes_update_own" on public.tailored_resumes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      resume_id is null
      or exists (
        select 1 from public.resumes r
        where r.id = tailored_resumes.resume_id and r.user_id = (select auth.uid())
      )
    )
  );
create policy "tailored_resumes_delete_own" on public.tailored_resumes
  for delete to authenticated using (user_id = (select auth.uid()));

-- xp_events: read-only for users
create policy "xp_events_select_own" on public.xp_events
  for select to authenticated using (user_id = (select auth.uid()));

-- consents: grant, update (re-consent) and withdraw own consents
create policy "consents_select_own" on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "consents_insert_own" on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "consents_update_own" on public.consents
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "consents_delete_own" on public.consents
  for delete to authenticated using (user_id = (select auth.uid()));
