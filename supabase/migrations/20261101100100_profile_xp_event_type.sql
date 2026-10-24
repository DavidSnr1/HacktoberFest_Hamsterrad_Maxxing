-- XP for finishing the onboarding chat (profile filled in).
alter type public.xp_event_type add value if not exists 'profile_completed';
