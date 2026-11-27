alter table public.agent_listings drop constraint if exists agent_listings_status_check;

update public.agent_listings set status = 'instructed' where status = 'draft';

alter table public.agent_listings alter column status set default 'instructed';

alter table public.agent_listings add constraint agent_listings_status_check
  check (status in (
    'valuation', 'valuation_lost', 'instructed',
    'for_sale', 'under_offer', 'sold_stc', 'exchanged', 'completed', 'withdrawn'
  ));

create or replace view public.public_agent_listings
  with (security_invoker = false) as
  select l.slug, l.status, l.listing, l.material_info, l.published_at,
         o.name as agency_name, o.agent_branch as agency_branch
  from public.agent_listings l
  join public.organisations o on o.id = l.organisation_id
  where l.status in ('for_sale', 'under_offer', 'sold_stc', 'exchanged', 'completed', 'withdrawn')
    and l.slug is not null
    and l.published_at is not null;
