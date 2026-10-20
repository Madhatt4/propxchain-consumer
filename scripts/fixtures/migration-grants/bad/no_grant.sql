create table if not exists public.party_things (
  id uuid primary key
);
alter table public.party_things enable row level security;
