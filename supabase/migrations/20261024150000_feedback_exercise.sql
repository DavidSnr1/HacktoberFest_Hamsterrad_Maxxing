-- Feedback includes a practice suggestion ("Übungsvorschlag") next to strengths
-- and improvements; it gets its own column like the other text parts.
alter table public.interview_feedback
  add column exercise text not null default '';
