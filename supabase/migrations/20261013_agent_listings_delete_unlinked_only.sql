-- A listing can be deleted only while no sale has started on it. Once
-- transaction_id is set, the deal's on-chain audit trail refers back to the
-- listing, so the agent withdraws it (status = 'withdrawn') instead.
drop policy if exists agent_listings_delete_members on public.agent_listings;
create policy agent_listings_delete_members on public.agent_listings for delete
  using (
    organisation_id in (select user_org_ids((select auth.uid())))
    and transaction_id is null
  );
