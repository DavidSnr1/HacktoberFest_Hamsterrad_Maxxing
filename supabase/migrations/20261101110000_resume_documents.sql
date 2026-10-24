-- Feature A: resumes generated from the candidate profile. Every user has at most
-- three – one per track (finance, consulting, startup). The track fixes structure and
-- tailoring; `target_role` is the role the user applies for (shown as headline).
-- Every revision is stored as a version; `active_version` points to the one shown and exported.

create table public.resume_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  track text not null check (track in ('finance', 'consulting', 'startup')),
  target_role text not null check (char_length(target_role) between 1 and 120),
  language text not null default 'de' check (language in ('de', 'en')),
  active_version integer not null default 1 check (active_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resume_documents_user_track_unique unique (user_id, track)
);

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null references public.resume_documents (id) on delete cascade,
  version integer not null check (version >= 1),
  content jsonb not null,
  -- Chat instruction that produced this version (null for the initial one).
  instruction text check (char_length(instruction) <= 1000),
  -- Short explanation of the model, shown in the chat.
  notes text check (char_length(notes) <= 1000),
  status text not null check (status in ('draft', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint resume_versions_document_version_unique unique (document_id, version)
);

create index resume_versions_user_id_idx on public.resume_versions (user_id);
-- At most one open draft per resume.
create unique index resume_versions_one_draft_idx on public.resume_versions (document_id) where status = 'draft';

create function public.resume_documents_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger resume_documents_touch_updated_at
  before update on public.resume_documents
  for each row execute function public.resume_documents_touch_updated_at();

alter table public.resume_documents enable row level security;
alter table public.resume_versions enable row level security;

revoke all on table public.resume_documents from anon, authenticated;
revoke all on table public.resume_versions from anon, authenticated;
grant select, insert, update, delete on table public.resume_documents to authenticated;
grant select, insert, update, delete on table public.resume_versions to authenticated;

create policy "resume_documents_select_own"
  on public.resume_documents for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "resume_documents_insert_own"
  on public.resume_documents for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "resume_documents_update_own"
  on public.resume_documents for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "resume_documents_delete_own"
  on public.resume_documents for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "resume_versions_select_own"
  on public.resume_versions for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "resume_versions_insert_own"
  on public.resume_versions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.resume_documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "resume_versions_update_own"
  on public.resume_versions for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.resume_documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "resume_versions_delete_own"
  on public.resume_versions for delete
  to authenticated
  using (user_id = (select auth.uid()));
