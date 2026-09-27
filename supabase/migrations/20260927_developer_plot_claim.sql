-- Developer plot invites: one working path (code review M16, 2026-09-27).
--
-- There were two half-built buyer-invite paths and neither could finish:
--   * the reservation saga wrote a hashed token to invite_codes, but nothing
--     ever built or sent the /redeem/dev link, and RLS let only the developer
--     read the table (so a buyer's lookup always said "invalid") and blocked
--     every UPDATE (so redeeming or revoking silently did nothing);
--   * the Join screen claims a plot by its invite_code, but it reserved the
--     plot with a client-side UPDATE on plots, which RLS limits to the
--     developer's org, so it silently changed nothing, and it required
--     'available', which the saga had already moved to 'pending'.
-- Prod on the day: 4 tokens, 0 redeemed, 1 plot stuck pending, 0 buyers linked.
--
-- Marc chose the per-plot code (it already creates the on-chain deal) and
-- dropped the token path. A reservation now names the buyer by email, and
-- only that signed-in email can claim the plot while it is pending. The
-- claim is a SECURITY DEFINER function so the buyer never needs write access
-- to plots.
--
-- Pre-launch posture: no customers, so the test tokens are dropped with the
-- table and any pending plot with no named buyer is freed. Nothing else is
-- backfilled.

-- ── Every plot gets a code ─────────────────────────────────────────────────
-- Same TX-XXXX-XXXX shape as transaction codes, so the Join screen accepts
-- it. No 0/O/1/I, to survive being read out over the phone.
create or replace function public.generate_plot_invite_code()
returns text
language plpgsql
volatile
set search_path = public, extensions, pg_temp
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(8);
  body text := '';
begin
  for i in 0..7 loop
    body := body || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return 'TX-' || substr(body, 1, 4) || '-' || substr(body, 5, 4);
end;
$$;

create unique index if not exists plots_invite_code_key on public.plots (invite_code);

update public.plots set invite_code = public.generate_plot_invite_code()
where invite_code is null;

alter table public.plots
  alter column invite_code set default public.generate_plot_invite_code();

-- ── Who a pending plot is held for ─────────────────────────────────────────
-- Personal data: stays in this members-only table. Never add it to
-- plots_public, and never write it on-chain.
alter table public.plots add column if not exists reserved_for_email text;

comment on column public.plots.reserved_for_email is
  'Lower-cased email of the buyer a pending reservation is held for. Personal data: off-chain only, not in plots_public.';

-- ── Retire the token path ──────────────────────────────────────────────────
drop table if exists public.invite_codes;

-- ── A released plot gets a new code ────────────────────────────────────────
-- Otherwise whoever held the old code (a buyer who pulled out, or anyone
-- they forwarded it to) could claim the plot the moment it is free again.
create or replace function public.plots_rotate_code_on_release()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.reservation_status = 'available'
     and old.reservation_status in ('pending', 'reserved') then
    new.invite_code := public.generate_plot_invite_code();
    new.reserved_for_email := null;
  end if;
  return new;
end;
$$;

drop trigger if exists plots_rotate_code_on_release on public.plots;
create trigger plots_rotate_code_on_release
  before update of reservation_status on public.plots
  for each row execute function public.plots_rotate_code_on_release();

-- Free any plot the old token path left pending with no named buyer (after
-- the trigger exists, so it also gets a fresh code).
update public.plots
set reservation_status = 'available', last_error = null
where reservation_status = 'pending' and reserved_for_email is null;

-- ── Can I claim this plot? (read-only, before the buyer creates a deal) ────
-- Returns 'ok' | 'reserved_for_other' | 'taken' | 'not_found'. Asked first so
-- a buyer who can't have the plot never creates an orphan on-chain deal.
create or replace function public.check_plot_claim(p_code text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_for text;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'sign in to claim a plot' using errcode = '28000';
  end if;

  select reservation_status, reserved_for_email into v_status, v_for
  from public.plots
  where invite_code = p_code
    and listing_status in ('published', 'reserved', 'completed');

  if not found then
    return 'not_found';
  end if;
  if v_status = 'available' then
    return 'ok';
  end if;
  if v_status = 'pending' then
    return case when v_for = v_email and v_email <> '' then 'ok' else 'reserved_for_other' end;
  end if;
  return 'taken';
end;
$$;

-- ── Claim it ───────────────────────────────────────────────────────────────
-- Atomic: the WHERE re-checks everything check_plot_claim did, so two buyers
-- racing for an open plot can't both win. Also swaps the reservation
-- snapshot's placeholder transaction id for the real one.
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
  returning id into v_plot;

  if v_plot is null then
    raise exception 'this plot is not available to you' using errcode = 'P0001';
  end if;

  update public.plot_listing_snapshots
  set transaction_id = p_transaction_id
  where plot_id = v_plot;

  return v_plot;
end;
$$;

-- REVOKE FROM PUBLIC does not touch anon/authenticated (they are granted by
-- default privileges at CREATE time), so name all three, after the CREATE.
revoke all on function public.check_plot_claim(text) from public, anon, authenticated;
revoke all on function public.claim_plot(text, text) from public, anon, authenticated;
grant execute on function public.check_plot_claim(text) to authenticated;
grant execute on function public.claim_plot(text, text) to authenticated;
