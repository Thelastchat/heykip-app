-- Money in gets a job. The safety net becomes a real pot, money can be taken back out of a goal (to cover a
-- month that ran over), and each money-in entry remembers which part was kept for spending.
alter table public.profiles add column if not exists safety_saved numeric(12, 2) not null default 0;
alter table public.transactions add column if not exists job jsonb;
comment on column public.transactions.job is 'Money in: what it was used for. {"spend": n, "cats": {"fun": n}, "goal": n, "safety": n}. Only spend/cats change this month''s spending money.';

create or replace function public.put_in_safety(p_amount numeric)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_total numeric;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'amount must not be 0';
  end if;
  update public.profiles set safety_saved = greatest(0, safety_saved + p_amount)
   where id = (select auth.uid())
   returning safety_saved into new_total;
  if new_total is null then
    raise exception 'profile not found';
  end if;
  return new_total;
end;
$$;
grant execute on function public.put_in_safety(numeric) to authenticated;

-- Taking money back out of a goal (never below 0). Recorded as a negative move so the history stays true.
create or replace function public.take_from_goal(p_goal uuid, p_amount numeric, p_note text default null)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  have numeric;
  take numeric;
  new_total numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be more than 0';
  end if;
  select saved_amount into have from public.goals where id = p_goal and user_id = (select auth.uid());
  if have is null then
    raise exception 'goal not found';
  end if;
  take := least(have, p_amount);
  if take = 0 then
    return have;
  end if;
  update public.goals set saved_amount = saved_amount - take where id = p_goal and user_id = (select auth.uid())
   returning saved_amount into new_total;
  insert into public.goal_moves (user_id, goal_id, amount, source, from_kind, note)
  values ((select auth.uid()), p_goal, -take, 'cover', null, p_note);
  return new_total;
end;
$$;
grant execute on function public.take_from_goal(uuid, numeric, text) to authenticated;

alter table public.goal_moves drop constraint goal_moves_source_check;
alter table public.goal_moves add constraint goal_moves_source_check check (source = any (array['payday', 'extra', 'cover']));
