-- Where money "sneaks away" (from Setup step 2). Kip uses it to nudge at the right moments.
alter table public.profiles add column money_leaks text[] not null default '{}';
