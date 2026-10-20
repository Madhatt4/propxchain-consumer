-- Tables outside public, temp tables and function bodies are out of scope.
create table if not exists geo.parcels (id int);
create temp table scratch (id int);
create or replace function public.make_thing() returns void language plpgsql as $$
begin
  create table if not exists public.made_at_runtime (id int);
end $$;
/* create table public.in_a_block_comment (id int); */
grant execute on function public.make_thing() to authenticated;
