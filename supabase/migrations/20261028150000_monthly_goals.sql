-- "Save every month" is a goal too: no target date, just an amount each month.
-- target_amount holds a year of it, so progress still has something to fill.
alter table public.goals drop constraint goals_kind_check;
alter table public.goals add constraint goals_kind_check check (kind in ('trip', 'gadget', 'car', 'home', 'safety_net', 'monthly'));
alter table public.goals add column monthly_amount numeric(12, 2) check (monthly_amount > 0);
