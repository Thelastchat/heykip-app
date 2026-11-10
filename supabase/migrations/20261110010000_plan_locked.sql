-- Plus can only be given by the server. Before this, anyone signed in could set their own profiles.plan to 'yearly'
-- (the row is theirs under RLS) and use Kip — which runs on HeyKip's AI bill — for free, forever.
--
-- 1. plan, trial_ends_at and trial_used can't be changed by the app. Only trusted code can: the functions below
--    (they mark the change as trusted for one statement) and the service role (future payments).
-- 2. A trial starts through start_trial(): once per person, 7 days, decided by the server's clock.
-- 3. An ended trial is just free: is_plus() checks the date, so nothing needs to run when it ends.
-- 4. AI use is counted per person per Bangkok day (kip_allow): a cap so a bug or a script can't run up the bill.

alter table public.profiles add column if not exists trial_used boolean not null default false;
alter table public.profiles add column if not exists ai_day date;
alter table public.profiles add column if not exists ai_count integer not null default 0;
-- Anyone who already had a trial has used it.
update public.profiles set trial_used = true where plan = 'trial' or trial_ends_at is not null;

create or replace function public.guard_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Trusted: the service role, or one of HeyKip's own functions for this one statement.
  if (select auth.role()) = 'service_role' or coalesce(current_setting('heykip.trusted', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.plan := 'free';
    new.trial_ends_at := null;
    new.trial_used := false;
    new.ai_day := null;
    new.ai_count := 0;
  else
    new.plan := old.plan;
    new.trial_ends_at := old.trial_ends_at;
    new.trial_used := old.trial_used;
    new.ai_day := old.ai_day;
    new.ai_count := old.ai_count;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_plan on public.profiles;
create trigger guard_plan before insert or update on public.profiles for each row execute function public.guard_plan();

-- Plus right now: paid, or a trial that hasn't ended.
create or replace function public.is_plus(p public.profiles)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p.plan in ('yearly', 'monthly', 'student') or (p.plan = 'trial' and p.trial_ends_at > now());
$$;

-- Start the 7-day trial: once per person. Returns when it ends.
create or replace function public.start_trial()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  p public.profiles;
  ends timestamptz;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  select * into p from public.profiles where id = me for update;
  if p.id is null then
    raise exception 'profile not found';
  end if;
  if public.is_plus(p) then
    return p.trial_ends_at;
  end if;
  if p.trial_used then
    raise exception 'trial already used';
  end if;
  ends := now() + interval '7 days';
  perform set_config('heykip.trusted', 'on', true);
  update public.profiles set plan = 'trial', trial_ends_at = ends, trial_used = true where id = me;
  perform set_config('heykip.trusted', 'off', true);
  return ends;
end;
$$;
revoke all on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;

-- Before any AI call (Kip, Tell Kip, slips): Plus, consent, and today's count. Counts this call when it's 'ok'.
-- Returns 'ok', 'plus' (not Plus), 'consent' (no Allow, or turned off) or 'limit' (today's cap reached).
create or replace function public.kip_allow(p_limit integer default 150)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  p public.profiles;
  today date := (now() at time zone 'Asia/Bangkok')::date;
  used integer;
begin
  if me is null then
    return 'plus';
  end if;
  select * into p from public.profiles where id = me for update;
  if p.id is null or not public.is_plus(p) then
    return 'plus';
  end if;
  if p.ai_consent_at is null or p.ai_off then
    return 'consent';
  end if;
  used := case when p.ai_day = today then p.ai_count else 0 end;
  if used >= least(greatest(p_limit, 1), 500) then
    return 'limit';
  end if;
  perform set_config('heykip.trusted', 'on', true);
  update public.profiles set ai_day = today, ai_count = used + 1 where id = me;
  perform set_config('heykip.trusted', 'off', true);
  return 'ok';
end;
$$;
revoke all on function public.kip_allow(integer) from public, anon;
grant execute on function public.kip_allow(integer) to authenticated;
