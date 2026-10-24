-- Feature C: jobs a user has bookmarked.

create table public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid not null references public.job_postings (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_jobs_user_job_unique unique (user_id, job_id)
);

create index saved_jobs_job_id_idx on public.saved_jobs (job_id);

alter table public.saved_jobs enable row level security;

revoke all on table public.saved_jobs from anon, authenticated;
grant select, insert, delete on table public.saved_jobs to authenticated;

create policy "saved_jobs_select_own"
  on public.saved_jobs for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "saved_jobs_insert_own"
  on public.saved_jobs for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "saved_jobs_delete_own"
  on public.saved_jobs for delete
  to authenticated
  using (user_id = (select auth.uid()));
