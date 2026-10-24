-- Feature B: at most one daily_streak event per user and calendar day in
-- Germany. Streak events have no ref_id, so the existing unique index on
-- (user_id, type, ref_id) does not cover them.
create unique index xp_events_daily_streak_day_key
  on public.xp_events (user_id, ((created_at at time zone 'Europe/Berlin')::date))
  where type = 'daily_streak';

-- Highest level the user has already seen celebrated; null until the
-- character page was opened once (then no animation for the existing level).
alter table public.profiles
  add column last_seen_level smallint check (last_seen_level between 1 and 5);
