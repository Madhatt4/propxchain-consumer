create table if not exists public.agent_listings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  slug text unique,
  status text not null default 'draft'
    check (status in ('draft','for_sale','under_offer','sold_stc','exchanged','completed','withdrawn')),
  source text not null default 'manual' check (source in ('rightmove','website','manual')),
  source_url text,
  listing jsonb not null,
  provenance jsonb not null default '{}'::jsonb,
  material_info jsonb not null default '{}'::jsonb,
  transaction_id text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_listings_org_idx on public.agent_listings(organisation_id);

alter table public.agent_listings enable row level security;

create policy agent_listings_select_members on public.agent_listings for select
  using (organisation_id in (select user_org_ids((select auth.uid()))));
create policy agent_listings_insert_members on public.agent_listings for insert
  with check (organisation_id in (select user_org_ids((select auth.uid()))));
create policy agent_listings_update_members on public.agent_listings for update
  using (organisation_id in (select user_org_ids((select auth.uid()))))
  with check (organisation_id in (select user_org_ids((select auth.uid()))));
create policy agent_listings_delete_members on public.agent_listings for delete
  using (organisation_id in (select user_org_ids((select auth.uid()))));

-- Public read: published, non-draft rows only, through a view that hides
-- transaction_id and organisation internals from anon callers.
create or replace view public.public_agent_listings
  with (security_invoker = false) as
  select l.slug, l.status, l.listing, l.material_info, l.published_at,
         o.name as agency_name, o.agent_branch as agency_branch
  from public.agent_listings l
  join public.organisations o on o.id = l.organisation_id
  where l.status <> 'draft' and l.slug is not null and l.published_at is not null;
grant select on public.public_agent_listings to anon, authenticated;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists agent_listings_touch on public.agent_listings;
create trigger agent_listings_touch before update on public.agent_listings
  for each row execute function public.touch_updated_at();
