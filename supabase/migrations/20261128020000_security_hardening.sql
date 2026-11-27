-- Security pass (28 Nov 2026). Row Level Security already keeps every row to its owner; this closes the doors around it.

-- 1. Signed-out visitors (anon) get nothing at all from the tables, not even their names: every screen needs an
--    account. (Policies already gave anon no rows; this removes the table rights too, now and for new tables.)
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- 2. Signed-in people keep read/write on their own rows, but never TRUNCATE (which ignores row rules), triggers or
--    foreign-key references.
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- 3. The profile row is made by the sign-up trigger and removed only by "Delete my account" (service role).
--    Deleting and re-making it from the app could reset the daily Kip, slip and voice counts.
revoke insert, delete on public.profiles from authenticated;

-- 4. Money functions run only for signed-in people.
revoke execute on function public.put_in_goal(uuid, numeric, text, text, text) from public, anon;
revoke execute on function public.put_in_safety(numeric, text, text) from public, anon;
revoke execute on function public.take_from_goal(uuid, numeric, text) from public, anon;
revoke execute on function public.is_plus(public.profiles) from public, anon;
grant execute on function public.put_in_goal(uuid, numeric, text, text, text) to authenticated;
grant execute on function public.put_in_safety(numeric, text, text) to authenticated;
grant execute on function public.take_from_goal(uuid, numeric, text) to authenticated;
grant execute on function public.is_plus(public.profiles) to authenticated;
revoke execute on function public.kip_allow(integer), public.slip_allow(), public.voice_allow(), public.start_fresh(), public.start_trial() from public, anon;
grant execute on function public.kip_allow(integer), public.slip_allow(), public.voice_allow(), public.start_fresh() to authenticated;

-- 5. Photos: profile photos are private now (the app shows them through week-long signed links), and every bucket
--    only takes images of a sensible size.
update storage.buckets set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'image/webp'] where id = 'avatars';
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'] where id = 'goal-photos';
update storage.buckets set file_size_limit = 1048576, allowed_mime_types = array['image/svg+xml', 'image/png'] where id = 'signatures';
