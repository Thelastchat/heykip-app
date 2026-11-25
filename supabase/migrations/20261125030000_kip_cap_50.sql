-- Kip's daily cap: 150 → 50 AI calls a day (Kip, Tell Kip, slips). At 150 one person maxing it out every day would
-- cost more in AI than Plus brings in (about ฿168 a month against ฿102.5 kept from ฿129); at 50 the worst case is
-- about ฿56. Everyday use is 3–5 calls. The ceiling is 50 whatever a caller passes, so no function can raise it.

create or replace function public.kip_allow(p_limit integer default 50)
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
  if used >= least(greatest(p_limit, 1), 50) then
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
