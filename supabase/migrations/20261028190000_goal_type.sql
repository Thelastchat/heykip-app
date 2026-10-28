-- What kind of goal it is (trip, family, beauty…): its icon and colour. kind = how Kip plans it.
alter table public.goals add column if not exists goal_type text;
