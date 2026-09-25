-- Widen party_invites SELECT to org scope.
--
-- The original policy (party_invites_own_select) scoped reads to
-- invited_by_user_id = auth.uid(), so a colleague of the agent who actually
-- sent the invite saw an empty parties panel for a listing their own
-- organisation owns. A caller may now also select a row when the listing it
-- was sent for belongs to an organisation they are a member of (via
-- user_org_ids), in addition to the existing self-select.
drop policy if exists party_invites_own_select on public.party_invites;
create policy party_invites_org_select on public.party_invites for select
  using (
    invited_by_user_id = (select auth.uid())
    or (
      listing_id is not null
      and exists (
        select 1
        from public.agent_listings al
        where al.id = party_invites.listing_id
          and al.organisation_id in (select user_org_ids((select auth.uid())))
      )
    )
  );
