-- Feature B: XP for CV milestones and for strong interview feedback.
-- Enum values are added in their own migration: they cannot be used in the
-- transaction that adds them.
alter type public.xp_event_type add value if not exists 'milestone';
alter type public.xp_event_type add value if not exists 'interview_bonus';
