-- Users who signed up before the profile trigger existed have no profile row.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
