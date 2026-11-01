-- Kip's AI (Talk to Kip, slip reading) only runs after the person agrees once, and stops when they turn it off.
alter table public.profiles
  add column if not exists ai_consent_at timestamptz,
  add column if not exists ai_off boolean not null default false;
comment on column public.profiles.ai_consent_at is 'When the person tapped Allow on "Before Kip reads for you" (PDPA consent + App Store 5.1.2(i)).';
comment on column public.profiles.ai_off is 'Privacy & data → "Let Kip read for me" turned off: nothing is sent to the AI.';
