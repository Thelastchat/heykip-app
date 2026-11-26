-- People's own categories ("Create your own"): need or want, so bills and money styles treat them right.
alter table public.categories add column if not exists need boolean not null default false;
