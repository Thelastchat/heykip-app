-- Payday made real (approved 27 Nov): the scheduled transfer the person set up in their own bank app — how much,
-- which day, which bank — and the last pay month they confirmed it went through. HeyKip never touches the bank;
-- this only lets Kip check on payday and say when the plan's saving no longer matches what the bank moves.
alter table public.profiles add column if not exists bank_transfer jsonb;
