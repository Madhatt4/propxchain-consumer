-- A plot that was reserved, released and reserved again could not be
-- reserved: "Saving snapshot" failed with "new row violates row-level
-- security policy (USING expression) for table plot_listing_snapshots".
--
-- Cause: one snapshot per plot (UNIQUE plot_id), written by the browser as an
-- upsert. The first reservation's snapshot outlives its release, so the second
-- reservation's upsert became an UPDATE, and snapshots have no UPDATE policy
-- (immutable by design). Plot 15A on the day: an April snapshot from an
-- earlier reservation. Releasing became routine with release_my_plot
-- (2026-10-08), so every re-reserved plot would hit this.
--
-- Fix: one snapshot per reservation, built by the server.
--   * A claimed reservation's snapshot is never touched again, so the record
--     of what an earlier buyer reserved survives their leaving (org members
--     still see it; the next buyer does not).
--   * A snapshot no buyer has claimed yet carries a placeholder
--     transaction_id (pending_...). At most one per plot; a new reservation
--     replaces it, and claim_plot swaps in the real deal id.
--   * The snapshot is copied from plots / plot_types / development_sites /
--     organisations inside the function, so the frozen fields can't be
--     anything other than what was listed, and developer_name gets filled.
--   * The browser can no longer write the table directly.
--
-- Pre-launch: the two existing rows are kept as they are.

-- ── One snapshot per reservation ───────────────────────────────────────────
alter table public.plot_listing_snapshots
  drop constraint if exists plot_listing_snapshots_plot_id_key;

create index if not exists plot_listing_snapshots_plot_id_idx
  on public.plot_listing_snapshots (plot_id);

create unique index if not exists plot_listing_snapshots_one_unclaimed_per_plot
  on public.plot_listing_snapshots (plot_id)
  where transaction_id like 'pending\_%';

-- ── The buyer sees only the snapshot of their own deal ─────────────────────
drop policy if exists plot_listing_snapshots_select_buyer_or_members on public.plot_listing_snapshots;
create policy plot_listing_snapshots_select_buyer_or_members
  on public.plot_listing_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1 from public.plots p
      where p.id = plot_listing_snapshots.plot_id
        and (
          (p.reserved_by_buyer_user_id = (select auth.uid())
            and p.transaction_id = plot_listing_snapshots.transaction_id)
          or p.site_id in (
            select id from public.development_sites
            where organisation_id in (select public.user_org_ids((select auth.uid())))
          )
        )
    )
  );

-- ── Only the server writes snapshots ───────────────────────────────────────
drop policy if exists plot_listing_snapshots_insert_members on public.plot_listing_snapshots;
revoke insert, update, delete, truncate on public.plot_listing_snapshots from anon, authenticated;

-- ── Take the snapshot (step 3 of the reservation) ──────────────────────────
-- Developer-org members only, and only while the plot is held (pending).
create or replace function public.snapshot_plot_reservation(p_plot_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_snapshot uuid;
begin
  if v_uid is null then
    raise exception 'sign in to reserve a plot' using errcode = '28000';
  end if;

  select p.reservation_status into v_status
  from public.plots p
  join public.development_sites s on s.id = p.site_id
  where p.id = p_plot_id
    and s.organisation_id in (select public.user_org_ids(v_uid));

  if not found then
    raise exception 'plot not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'plot is not held for a buyer' using errcode = 'P0001';
  end if;

  -- An earlier attempt that no buyer claimed (it failed, or the developer
  -- released the hold). Claimed snapshots are never removed.
  delete from public.plot_listing_snapshots
  where plot_id = p_plot_id
    and transaction_id like 'pending\_%';

  insert into public.plot_listing_snapshots (
    plot_id, transaction_id,
    plot_number, sale_price_pence, description_addendum,
    expected_practical_completion, plot_specific_image_refs, features_addendum,
    plot_type_name, plot_type_description, plot_type_bedrooms,
    plot_type_bathrooms, plot_type_internal_area_sqft, plot_type_epc_rating,
    plot_type_floor_plan_image_refs, plot_type_exterior_image_refs,
    plot_type_interior_image_refs, plot_type_features,
    site_name, site_address, developer_name
  )
  select
    p.id, 'pending_' || replace(gen_random_uuid()::text, '-', ''),
    p.plot_number, p.sale_price_pence, p.description_addendum,
    p.expected_practical_completion, p.plot_specific_image_refs, p.features_addendum,
    pt.name, pt.description, pt.bedrooms,
    pt.bathrooms, pt.internal_area_sqft, pt.epc_rating,
    pt.floor_plan_image_refs, pt.exterior_image_refs,
    pt.interior_image_refs, pt.features,
    s.name, s.address, o.name
  from public.plots p
  join public.development_sites s on s.id = p.site_id
  join public.organisations o on o.id = s.organisation_id
  left join public.plot_types pt on pt.id = p.plot_type_id
  where p.id = p_plot_id
  returning id into v_snapshot;

  return v_snapshot;
end;
$$;

revoke all on function public.snapshot_plot_reservation(uuid) from public, anon, authenticated;
grant execute on function public.snapshot_plot_reservation(uuid) to authenticated;

-- ── Claim swaps in the real deal id on the unclaimed snapshot only ─────────
-- Unchanged from 20260927_developer_plot_claim apart from the snapshot step.
-- A plot claimed straight from 'available' had no hold for this buyer, so any
-- placeholder left by an earlier, released hold is stale and is dropped
-- rather than passed off as what this buyer reserved.
create or replace function public.claim_plot(p_code text, p_transaction_id text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_plot uuid;
  v_held_for text;
begin
  if v_uid is null then
    raise exception 'sign in to claim a plot' using errcode = '28000';
  end if;
  if p_transaction_id is null or p_transaction_id !~ '^[0-9a-zA-Z_-]+$' then
    raise exception 'invalid transaction id' using errcode = '22023';
  end if;

  update public.plots
  set reservation_status = 'reserved',
      reserved_by_buyer_user_id = v_uid,
      reserved_at = now(),
      transaction_id = p_transaction_id,
      last_error = null
  where invite_code = p_code
    and listing_status in ('published', 'reserved', 'completed')
    and (
      reservation_status = 'available'
      or (reservation_status = 'pending' and v_email <> '' and reserved_for_email = v_email)
    )
  returning id, reserved_for_email into v_plot, v_held_for;

  if v_plot is null then
    raise exception 'this plot is not available to you' using errcode = 'P0001';
  end if;

  if v_held_for is not null then
    update public.plot_listing_snapshots
    set transaction_id = p_transaction_id
    where plot_id = v_plot
      and transaction_id like 'pending\_%';
  else
    delete from public.plot_listing_snapshots
    where plot_id = v_plot
      and transaction_id like 'pending\_%';
  end if;

  return v_plot;
end;
$$;

revoke all on function public.claim_plot(text, text) from public, anon, authenticated;
grant execute on function public.claim_plot(text, text) to authenticated;
