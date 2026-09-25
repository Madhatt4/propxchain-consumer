-- The agent's own listing page for this property, on their own website.
--
-- Deliberately NOT `source_url`. That column holds the Rightmove/OnTheMarket
-- URL the listing was imported from (ListingCreatePage passes `listing.url`),
-- so pointing a buyer-facing link at it would send them to a competitor portal
-- showing the same property. The two are different facts about one listing and
-- both are worth keeping.
--
-- Not added to the `public_agent_listings` view: that view is an explicit
-- column allowlist and the public page has no use for this yet.

alter table public.agent_listings
  add column if not exists agent_url text;

comment on column public.agent_listings.agent_url is
  'The agency''s own listing page for this property. Agent-entered, http(s) only.';
