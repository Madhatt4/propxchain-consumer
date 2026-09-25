-- Enforce one-to-one agent_listings <-> transaction_id.
--
-- Without this, send-party-invite's org-linkage authorisation check
-- (agent_listings.id = listing_id AND transaction_id = body.transaction_id)
-- is still forgeable: nothing stopped a second agent_listings row (in a
-- DIFFERENT organisation) from also being linked to the same
-- transaction_id, letting that org's member pass the linkage check for a
-- transaction they don't actually own. A partial unique index (ignoring
-- nulls, since most listings are never linked to a transaction) closes
-- that gap at the data layer.
--
-- Guarded before creation via:
--   select transaction_id, count(*) from public.agent_listings
--   where transaction_id is not null group by 1 having count(*) > 1;
-- 2026-08-24: zero rows returned — phase 3 hasn't shipped, safe to apply.
create unique index if not exists agent_listings_transaction_id_uidx
  on public.agent_listings (transaction_id)
  where transaction_id is not null;
