-- Plus through Apple's In-App Purchase (DPLA 3.3.1(C) and Attachment 2: paid features only through IAP, and
-- unlocked only after the purchase is verified). RevenueCat verifies the App Store receipt and calls the
-- revenuecat edge function, which (as the service role) writes the plan. Nothing else can.
--
-- 1. plan_until: the end of the period Apple charged for. A paid plan counts until then, plus a day's grace for a
--    late renewal notice. The free week is the subscription's introductory offer: plan 'trial' with trial_ends_at.
-- 2. start_trial() is retired: a free week from our own server would be Plus outside In-App Purchase.

alter table public.profiles add column if not exists plan_until timestamptz;

create or replace function public.guard_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Trusted: the service role (the revenuecat function), or one of HeyKip's own functions for this one statement.
  if (select auth.role()) = 'service_role' or coalesce(current_setting('heykip.trusted', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.plan := 'free';
    new.trial_ends_at := null;
    new.plan_until := null;
    new.trial_used := false;
    new.ai_day := null;
    new.ai_count := 0;
  else
    new.plan := old.plan;
    new.trial_ends_at := old.trial_ends_at;
    new.plan_until := old.plan_until;
    new.trial_used := old.trial_used;
    new.ai_day := old.ai_day;
    new.ai_count := old.ai_count;
  end if;
  return new;
end;
$$;

-- Plus right now: a paid period that hasn't ended (with a day's grace), or a free week that hasn't ended.
create or replace function public.is_plus(p public.profiles)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (p.plan in ('yearly', 'monthly', 'student') and (p.plan_until is null or p.plan_until + interval '1 day' > now()))
      or (p.plan = 'trial' and p.trial_ends_at > now());
$$;

-- Retired: the free week now comes from Apple (the subscription's introductory offer).
create or replace function public.start_trial()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Plus starts through the App Store';
end;
$$;
revoke all on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;
