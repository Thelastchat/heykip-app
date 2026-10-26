-- HeyKip · Step 1 · core schema
-- Every table is private to its owner through Row Level Security.

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  onboarded boolean not null default false,
  income_type text not null default 'regular' check (income_type in ('regular', 'changes')),
  monthly_income numeric(12, 2),
  slow_month_income numeric(12, 2),
  good_month_income numeric(12, 2),
  split_when_paid boolean not null default false,
  payday smallint check (payday between 1 and 31),
  month_starts_on_payday boolean not null default true,
  rent numeric(12, 2),
  daily_budget numeric(12, 2),
  money_style text,
  kip_tone text not null default 'friendly',
  language text not null default 'en' check (language in ('en', 'th')),
  checkin_time time not null default '21:00',
  plan text not null default 'free' check (plan in ('free', 'trial', 'yearly', 'monthly', 'student')),
  trial_ends_at timestamptz,
  ai_actions_today integer not null default 0,
  ai_actions_date date,
  created_at timestamptz not null default now()
);

-- Create the profile automatically when someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- categories (user_id null = built-in) ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  kind text not null check (kind in ('spend', 'income')),
  key text not null,
  name text not null,
  color text not null,
  icon text not null,
  sort smallint not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index categories_builtin_key on public.categories (kind, key) where user_id is null;
create unique index categories_user_key on public.categories (user_id, kind, key) where user_id is not null;

-- ---------- goals (max 3 pinned) ----------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  photo_url text,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  saved_amount numeric(12, 2) not null default 0 check (saved_amount >= 0),
  due_date date,
  kind text check (kind in ('trip', 'gadget', 'car', 'home', 'safety_net')),
  pin_color text,
  position smallint check (position between 1 and 3),
  status text not null default 'active' check (status in ('active', 'someday', 'done')),
  created_at timestamptz not null default now()
);
create unique index goals_one_per_pin on public.goals (user_id, position) where status = 'active';

-- ---------- transactions ----------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('spend', 'income')),
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid references public.categories (id) on delete set null,
  note text,
  occurred_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('voice', 'typed', 'slip', 'manual')),
  slip_ref text,
  created_at timestamptz not null default now()
);
create index transactions_user_time on public.transactions (user_id, occurred_at desc);
create unique index transactions_one_slip on public.transactions (user_id, slip_ref) where slip_ref is not null;

-- ---------- budgets ----------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  monthly_limit numeric(12, 2) not null check (monthly_limit >= 0),
  cycle_start date not null,
  created_at timestamptz not null default now(),
  unique (user_id, category_id, cycle_start)
);

-- ---------- goal_moves (money moved into a goal is NOT spending) ----------
create table public.goal_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  amount numeric(12, 2) not null,
  moved_at timestamptz not null default now()
);

-- ---------- promises ----------
create table public.promises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  text text not null,
  signature_url text,
  signed_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.goals enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goal_moves enable row level security;
alter table public.promises enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "read built-in and own categories" on public.categories
  for select to authenticated using (user_id is null or (select auth.uid()) = user_id);
create policy "write own categories" on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own categories" on public.categories
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own categories" on public.categories
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own goals" on public.goals
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own transactions" on public.transactions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own budgets" on public.budgets
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own goal moves" on public.goal_moves
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own promises" on public.promises
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- built-in categories ----------
insert into public.categories (user_id, kind, key, name, color, icon, sort) values
  (null, 'spend', 'food',         'Food & drinks',   '#F6FF9A', 'ForkKnife',    1),
  (null, 'spend', 'transport',    'Transport',       '#AAC4E4', 'Car',          2),
  (null, 'spend', 'shopping',     'Shopping',        '#E27651', 'ShoppingBag',  3),
  (null, 'spend', 'home_bills',   'Home & bills',    '#B98070', 'House',        4),
  (null, 'spend', 'fun',          'Fun',             '#CAC2DF', 'Ticket',       5),
  (null, 'spend', 'health_beauty','Health & beauty', '#E7E1F0', 'Heart',        6),
  (null, 'spend', 'travel',       'Travel',          '#FCDCB3', 'AirplaneTilt', 7),
  (null, 'spend', 'family_pets',  'Family & pets',   '#D9E6CF', 'PawPrint',     8),
  (null, 'spend', 'giving',       'Giving',          '#F4D3DA', 'Gift',         9),
  (null, 'spend', 'learning',     'Learning',        '#EDE6E5', 'BookOpen',    10),
  (null, 'spend', 'installments', 'Installments',    '#E3D8D0', 'CreditCard',  11),
  (null, 'spend', 'other',        'Other',           '#F2F2EF', 'DotsThree',   12),
  (null, 'income', 'pay',         'Pay',             '#F6FF9A', 'Money',        1),
  (null, 'income', 'side_gigs',   'Side gigs',       '#AAC4E4', 'Laptop',       2),
  (null, 'income', 'gifts',       'Gifts',           '#E27651', 'Envelope',     3),
  (null, 'income', 'other',       'Other',           '#F2F2EF', 'DotsThree',    4);

-- ---------- storage for goal photos and signatures (private, per-user folders) ----------
insert into storage.buckets (id, name, public) values ('goal-photos', 'goal-photos', false), ('signatures', 'signatures', false)
  on conflict (id) do nothing;

create policy "own goal photos" on storage.objects
  for all to authenticated
  using (bucket_id in ('goal-photos', 'signatures') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('goal-photos', 'signatures') and (storage.foldername(name))[1] = (select auth.uid())::text);
