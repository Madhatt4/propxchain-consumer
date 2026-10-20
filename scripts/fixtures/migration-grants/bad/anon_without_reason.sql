create table public.listings (id int);
grant all on public.listings to service_role;
-- public read
grant select on public.listings to anon, authenticated;
