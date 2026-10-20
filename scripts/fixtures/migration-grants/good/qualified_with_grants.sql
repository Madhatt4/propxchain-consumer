-- A public table with the grants it needs, in the same file.
create table if not exists public.widgets (
  id uuid primary key default gen_random_uuid(),
  note text default 'create table public.not_a_table;'
);
alter table public.widgets enable row level security;
grant select, insert, update, delete on table public.widgets to authenticated, service_role;
