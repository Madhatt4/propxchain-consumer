-- Estate agent organisations: branch + redress scheme live on the org row.
-- Companies House is optional for agents (many independents are sole
-- traders / partnerships) — unlike developers, where it is mandatory.
alter table public.organisations
  add column if not exists agent_branch text,
  add column if not exists redress_scheme text,
  add column if not exists redress_number text;

alter table public.organisations
  drop constraint if exists organisations_redress_scheme_check;
alter table public.organisations
  add constraint organisations_redress_scheme_check
  check (redress_scheme is null or redress_scheme in ('PRS', 'TPO'));

create or replace function public.create_estate_agent_org_atomic(
  p_user_id uuid,
  p_name text,
  p_branch text,
  p_redress_scheme text,
  p_redress_number text,
  p_companies_house_number text,
  p_companies_house_verified boolean,
  p_ch_snapshot jsonb
) returns public.organisations
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  with new_org as (
    insert into public.organisations (
      name, type, agent_branch, redress_scheme, redress_number,
      companies_house_number, companies_house_verified, companies_house_snapshot,
      primary_contact_user_id, billing_contact_user_id
    ) values (
      p_name, 'agent', p_branch, p_redress_scheme, p_redress_number,
      p_companies_house_number, coalesce(p_companies_house_verified, false), p_ch_snapshot,
      p_user_id, p_user_id
    )
    returning *
  ),
  new_membership as (
    insert into public.organisation_memberships (user_id, organisation_id, role)
    select p_user_id, id, 'admin' from new_org
    returning organisation_id
  )
  select new_org.* from new_org, new_membership;
$$;

revoke all on function public.create_estate_agent_org_atomic(uuid, text, text, text, text, text, boolean, jsonb) from public, anon, authenticated;
