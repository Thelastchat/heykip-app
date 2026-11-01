-- Uploading a profile photo uses "upsert" (replace if it's there), and Storage needs to be able to look for your
-- own file first. Without this, every photo upload failed with "new row violates row-level security policy".
create policy "own avatar read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
