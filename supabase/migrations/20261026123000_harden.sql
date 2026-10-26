-- HeyKip · Step 1 · hardening from Supabase advisors

-- Trigger-only functions: nobody should call them through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- Index every foreign key so deletes and joins stay fast.
create index budgets_category on public.budgets (category_id);
create index goal_moves_goal on public.goal_moves (goal_id);
create index goal_moves_user on public.goal_moves (user_id, moved_at desc);
create index promises_goal on public.promises (goal_id);
create index promises_user on public.promises (user_id);
create index transactions_category on public.transactions (category_id);
