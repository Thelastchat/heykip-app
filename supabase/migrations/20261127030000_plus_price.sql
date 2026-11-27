-- HeyKip Plus as a bill (approved 27 Nov): what the person really pays, from the App Store receipt via RevenueCat's
-- notice (price_in_purchased_currency). Only the revenuecat function (service role) writes it; guard_plan keeps the
-- app from changing it, like the plan itself.
alter table public.profiles add column if not exists plus_price jsonb;

create or replace function public.guard_plan()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
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
    new.voice_day := null;
    new.voice_count := 0;
    new.plus_price := null;
  else
    new.plan := old.plan;
    new.trial_ends_at := old.trial_ends_at;
    new.plan_until := old.plan_until;
    new.trial_used := old.trial_used;
    new.ai_day := old.ai_day;
    new.ai_count := old.ai_count;
    new.slip_day := old.slip_day;
    new.slip_count := old.slip_count;
    new.voice_day := old.voice_day;
    new.voice_count := old.voice_count;
    new.plus_price := old.plus_price;
  end if;
  return new;
end;
$function$;
