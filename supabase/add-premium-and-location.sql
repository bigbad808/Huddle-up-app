-- Run this in Supabase SQL Editor as a NEW snippet, after your original
-- schema.sql has already been run successfully.

alter table profiles add column if not exists is_premium boolean default false;
alter table pods add column if not exists meeting_spot text;

-- Lets any member of a pod set/update the meeting spot for that pod.
create policy "pod members can update meeting spot"
  on pods for update to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.pod_id = pods.id
      and profiles.user_id = auth.uid()
    )
  );
