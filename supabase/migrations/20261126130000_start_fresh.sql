-- Start fresh (approved mockup): clears everything a person made in HeyKip in one go and sends them back to setup,
-- but keeps their login, their plan (Plus, trial end date, trial used), today's AI counters and their privacy
-- choices. The plan columns are never touched here, so starting fresh can't restart a free trial.
-- Photos in storage are removed by the app first (the person's own folders; storage policies allow only their own).

create or replace function public.start_fresh()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  delete from public.transactions where user_id = me;
  delete from public.goal_moves where user_id = me;
  delete from public.safety_moves where user_id = me;
  delete from public.promises where user_id = me;
  delete from public.goals where user_id = me;
  delete from public.budgets where user_id = me;
  delete from public.categories where user_id = me;
  update public.profiles set
    onboarded = false,
    income_type = 'regular',
    monthly_income = null,
    slow_month_income = null,
    good_month_income = null,
    split_when_paid = false,
    payday = null,
    month_starts_on_payday = true,
    rent = null,
    daily_budget = null,
    money_style = null,
    money_leaks = '{}',
    budget_style = 'kip',
    budget = null,
    safety_saved = 0
  where id = me;
end;
$$;
revoke all on function public.start_fresh() from public, anon;
grant execute on function public.start_fresh() to authenticated;
