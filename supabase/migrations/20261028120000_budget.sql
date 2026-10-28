-- "Your month": the money style picked in Setup and this month's split
-- (saving first → bills → everyday categories). Kept as one small JSON document per person.
alter table public.profiles add column budget_style text not null default 'kip'
  check (budget_style in ('kip', '503020', 'jars', 'savefirst'));
alter table public.profiles add column budget jsonb;
