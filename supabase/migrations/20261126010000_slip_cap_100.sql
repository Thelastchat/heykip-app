-- Slips get their own daily allowance (approved 26 Nov): reading a month of bank slips can take 40+ reads, which
-- would use up Kip's 50 a day for chatting. A slip read costs about ฿0.017, so 100 a day is about ฿1.7 at most.
-- Same rules as kip_allow (Plus, the person's Allow, counted on the server); only the counter is separate.

alter table public.profiles add column if not exists slip_day date;
alter table public.profiles add column if not exists slip_count integer not null default 0;

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
    new.slip_day := null;
    new.slip_count := 0;
  else
    new.plan := old.plan;
    new.trial_ends_at := old.trial_ends_at;
    new.plan_until := old.plan_until;
    new.trial_used := old.trial_used;
    new.ai_day := old.ai_day;
    new.ai_count := old.ai_count;
    new.slip_day := old.slip_day;
    new.slip_count := old.slip_count;
  end if;
  return new;
end;
$$;

create or replace function public.slip_allow()
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
  used := case when p.slip_day = today then p.slip_count else 0 end;
  if used >= 100 then
    return 'limit';
  end if;
  perform set_config('heykip.trusted', 'on', true);
  update public.profiles set slip_day = today, slip_count = used + 1 where id = me;
  perform set_config('heykip.trusted', 'off', true);
  return 'ok';
end;
$$;
revoke all on function public.slip_allow() from public, anon;
grant execute on function public.slip_allow() to authenticated;
