-- The safety net's history: every baht in and out, and why.
create table if not exists public.safety_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null, -- + in, − out
  kind text not null check (kind in ('payday', 'extra', 'manual', 'cover', 'emergency')),
  reason text check (reason is null or reason in ('health', 'repair', 'family', 'other')),
  created_at timestamptz not null default now()
);
create index if not exists safety_moves_user_idx on public.safety_moves (user_id, created_at desc);
alter table public.safety_moves enable row level security;
create policy "own safety moves" on public.safety_moves for select to authenticated using ((select auth.uid()) = user_id);
create policy "own safety moves insert" on public.safety_moves for insert to authenticated with check ((select auth.uid()) = user_id);

-- Money in or out of the safety net, recorded together with its reason. Never below 0.
drop function if exists public.put_in_safety(numeric);
create or replace function public.put_in_safety(p_amount numeric, p_kind text default 'manual', p_reason text default null)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  have numeric;
  moved numeric;
  new_total numeric;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'amount must not be 0';
  end if;
  select safety_saved into have from public.profiles where id = (select auth.uid());
  if have is null then
    raise exception 'profile not found';
  end if;
  moved := greatest(p_amount, -have); -- can't take out more than is there
  update public.profiles set safety_saved = safety_saved + moved where id = (select auth.uid())
   returning safety_saved into new_total;
  if moved <> 0 then
    insert into public.safety_moves (user_id, amount, kind, reason) values ((select auth.uid()), moved, p_kind, p_reason);
  end if;
  return new_total;
end;
$$;
grant execute on function public.put_in_safety(numeric, text, text) to authenticated;
