-- agent_listings.transaction_id becomes server-written only (security scan
-- 2026-09-23, H3).
--
-- That column is trusted as proof that an agent's organisation is on a deal:
-- the monorepo's can_claim_party_role (20260830000002, clause c) lets a member
-- of the listing's org claim a transaction_party_roles row on the linked
-- transaction, and send-party-invite authorises invites the same way. But
-- agent_listings' own insert/update policies only check org membership, so
-- ANY user could create an unverified agent org, set transaction_id to a
-- stranger's deal, and then self-grant a buyer/seller role on it — reading the
-- roster and the deal's search orders, and sending branded invites about it.
--
-- The link is now asserted by the monorepo edge function
-- link-listing-transaction, which checks org membership, a principal proof
-- and — on-chain — that the caller's own start-sale created the deal, then
-- writes as service_role. This trigger makes every other writer unable to
-- set or change the column, on INSERT as well as UPDATE (an insert could
-- otherwise carry a transaction_id from the start).
--
-- Pre-launch posture: the one existing linked row (verified 2026-09-23) is
-- left as is; nothing is backfilled or unlinked.

create or replace function public.agent_listings_transaction_id_server_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- service_role (edge functions) and direct DB sessions (migrations, SQL
  -- editor) have no 'authenticated'/'anon' JWT role and pass through.
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.transaction_id is not null then
      raise exception 'agent_listings.transaction_id is set by link-listing-transaction only'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.transaction_id is distinct from old.transaction_id then
      raise exception 'agent_listings.transaction_id is set by link-listing-transaction only'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists agent_listings_transaction_id_server_only on public.agent_listings;
create trigger agent_listings_transaction_id_server_only
  before insert or update on public.agent_listings
  for each row execute function public.agent_listings_transaction_id_server_only();
