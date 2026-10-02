-- Huddle Up — database schema
-- Run this once in your Supabase project's SQL editor (Dashboard > SQL Editor > New query)

create extension if not exists "pgcrypto";

create table pods (
  id uuid primary key default gen_random_uuid(),
  activity text not null,
  days text[] not null,
  time_slot text not null,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  name text,
  activity text not null,
  level text,
  days text[] not null,
  time_slot text not null,
  city text,
  pod_id uuid references pods(id),
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  pod_id uuid references pods(id) not null,
  user_id uuid references auth.users not null,
  name text,
  body text not null,
  created_at timestamptz default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table pods enable row level security;
alter table messages enable row level security;

-- NOTE: these policies are intentionally simple for an early-stage test, not
-- a production security model. Anyone signed in can read all profiles/pods
-- (needed so the matching logic and pod pages work) but can only write
-- their own data.

create policy "profiles are viewable by any signed-in user"
  on profiles for select to authenticated using (true);

create policy "users can insert their own profile"
  on profiles for insert to authenticated with check (auth.uid() = user_id);

create policy "users can update their own profile"
  on profiles for update to authenticated using (auth.uid() = user_id);

create policy "pods are viewable by any signed-in user"
  on pods for select to authenticated using (true);

create policy "messages are viewable by any signed-in user"
  on messages for select to authenticated using (true);

create policy "users can insert their own messages"
  on messages for insert to authenticated with check (auth.uid() = user_id);

-- Enable realtime so the pod chat updates live
alter publication supabase_realtime add table messages;
