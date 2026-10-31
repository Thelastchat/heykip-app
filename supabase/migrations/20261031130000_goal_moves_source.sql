alter table public.goal_moves
  add column if not exists source text not null default 'extra' check (source in ('payday', 'extra')),
  add column if not exists from_kind text check (from_kind in ('bonus', 'leftover', 'side', 'gift', 'other')),
  add column if not exists note text;

create index if not exists goal_moves_goal_idx on public.goal_moves (goal_id, moved_at desc);

-- Put money in a goal: records the move and updates the goal's total in one step.
create or replace function public.put_in_goal(p_goal uuid, p_amount numeric, p_source text default 'extra', p_from text default null, p_note text default null)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_total numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be more than 0';
  end if;
  update public.goals set saved_amount = saved_amount + p_amount
   where id = p_goal and user_id = (select auth.uid())
   returning saved_amount into new_total;
  if new_total is null then
    raise exception 'goal not found';
  end if;
  insert into public.goal_moves (user_id, goal_id, amount, source, from_kind, note)
  values ((select auth.uid()), p_goal, p_amount, p_source, p_from, p_note);
  return new_total;
end;
$$;

grant execute on function public.put_in_goal(uuid, numeric, text, text, text) to authenticated;
