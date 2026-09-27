-- Search sign-off, built properly (code review M23, 2026-09-27).
--
-- The old sign-off lived in one browser's localStorage and covered uploaded
-- files nobody else could see. Nothing rendered it. Marc's decisions:
--   * what is signed off: the deal's search orders whose results are back;
--   * who signs: the buyer and/or the buyer's conveyancer, each in their own
--     right (a record per signer, not one shared record);
--   * every party on the deal can see the status;
--   * the record lives here, and its SHA-256 goes on-chain via the ledger
--     (no names on-chain). Revocations are recorded and hashed the same way.
--
-- All writes go through SECURITY DEFINER functions that derive the signer's
-- role from transaction_party_roles, so the client can't claim a role, pick
-- orders, or backdate a record.

-- ── Which searches are back? ───────────────────────────────────────────────
-- Results land on each provider's own table, not on search_orders.status.
create or replace function public.search_results_state(p_order public.search_orders)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_order.status = 'completed'
    or exists (select 1 from public.onesearch_orders o
               where o.search_order_id = p_order.id and o.status = 'results_received')
    or exists (select 1 from public.groundsure_orders g
               where g.search_order_id = p_order.id and g.status = 'complete')
    -- tmgroup_orders has no search_order_id; it links by transaction.
    or (p_order.provider = 'tmgroup' and exists (
          select 1 from public.tmgroup_orders t
          where t.transaction_id = p_order.transaction_id and t.status = 'completed'));
$$;

-- Party membership reuses can_read_transaction_party_roles (20260824): true
-- when the caller has any role row on the deal. NOT the legacy
-- is_transaction_party(), which reads a table that no longer exists.

-- The caller's sign-off role on this deal, or null if they can't sign.
create or replace function public.my_search_signoff_role(p_transaction_id text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when bool_or(r.role = 'buyer') then 'buyer'
    when bool_or(r.role = 'conveyancer' and r.side = 'buyer') then 'conveyancer'
  end
  from public.transaction_party_roles r
  where r.transaction_id = p_transaction_id and r.user_id = auth.uid();
$$;

-- Every live order on the deal, with whether its results are back.
create or replace function public.transaction_search_status(p_transaction_id text)
returns table (search_order_id uuid, provider text, ordered_at timestamptz, has_results boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_read_transaction_party_roles(p_transaction_id) then
    raise exception 'not a party to this transaction' using errcode = '42501';
  end if;
  return query
    select so.id, so.provider, so.created_at, public.search_results_state(so)
    from public.search_orders so
    where so.transaction_id = p_transaction_id
      and so.status in ('ordered', 'in_progress', 'completed')
    order by so.created_at;
end;
$$;

-- ── The record ─────────────────────────────────────────────────────────────
create table if not exists public.search_signoffs (
  id               uuid primary key default gen_random_uuid(),
  transaction_id   text not null,
  signer_user_id   uuid not null references auth.users(id),
  signer_role      text not null check (signer_role in ('buyer', 'conveyancer')),
  search_order_ids uuid[] not null check (cardinality(search_order_ids) > 0),
  notes            text check (notes is null or length(notes) <= 2000),
  signed_at        timestamptz not null default now(),
  record_hash      text not null,
  revoked_at       timestamptz,
  revoke_reason    text,
  revoke_hash      text,
  check ((revoked_at is null) = (revoke_reason is null) and (revoked_at is null) = (revoke_hash is null))
);

-- One live sign-off per signer per deal; revoke to sign again.
create unique index if not exists search_signoffs_one_live
  on public.search_signoffs (transaction_id, signer_user_id)
  where revoked_at is null;

alter table public.search_signoffs enable row level security;

drop policy if exists search_signoffs_select_parties on public.search_signoffs;
create policy search_signoffs_select_parties on public.search_signoffs
  for select to authenticated
  using (public.can_read_transaction_party_roles(transaction_id));
-- No insert/update/delete policies: writes only through the functions below.

-- ── Sign off ───────────────────────────────────────────────────────────────
-- The hash covers exactly what was signed, so the on-chain anchor proves the
-- row hasn't been edited since.
create or replace function public.sign_off_searches(p_transaction_id text, p_notes text)
returns table (id uuid, signer_role text, search_order_ids uuid[], signed_at timestamptz, record_hash text)
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_role text := public.my_search_signoff_role(p_transaction_id);
  v_orders uuid[];
  v_at timestamptz := now();
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_hash text;
  v_id uuid;
begin
  if v_role is null then
    raise exception 'only the buyer or the buyer''s conveyancer can sign off searches'
      using errcode = '42501';
  end if;

  select array_agg(s.search_order_id order by s.search_order_id) into v_orders
  from public.transaction_search_status(p_transaction_id) s
  where s.has_results;

  if v_orders is null then
    raise exception 'no search results are back yet' using errcode = 'P0001';
  end if;

  v_hash := encode(digest(jsonb_build_object(
    'transactionId', p_transaction_id,
    'signerUserId', auth.uid(),
    'signerRole', v_role,
    'searchOrderIds', to_jsonb(v_orders),
    'notes', v_notes,
    'signedAt', v_at
  )::text, 'sha256'), 'hex');

  insert into public.search_signoffs
    (transaction_id, signer_user_id, signer_role, search_order_ids, notes, signed_at, record_hash)
  values (p_transaction_id, auth.uid(), v_role, v_orders, v_notes, v_at, v_hash)
  returning search_signoffs.id into v_id;

  return query select v_id, v_role, v_orders, v_at, v_hash;
exception
  when unique_violation then
    raise exception 'you have already signed off these searches; revoke it first to sign again'
      using errcode = 'P0001';
end;
$$;

-- ── Revoke ─────────────────────────────────────────────────────────────────
create or replace function public.revoke_search_signoff(p_signoff_id uuid, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_at timestamptz := now();
  v_record text;
  v_hash text;
begin
  if v_reason is null then
    raise exception 'give a reason for revoking' using errcode = '22023';
  end if;

  select record_hash into v_record from public.search_signoffs
  where id = p_signoff_id and signer_user_id = auth.uid() and revoked_at is null;
  if v_record is null then
    raise exception 'no live sign-off of yours to revoke' using errcode = 'P0001';
  end if;

  v_hash := encode(digest(jsonb_build_object(
    'signoffId', p_signoff_id,
    'recordHash', v_record,
    'reason', v_reason,
    'revokedAt', v_at
  )::text, 'sha256'), 'hex');

  update public.search_signoffs
  set revoked_at = v_at, revoke_reason = v_reason, revoke_hash = v_hash
  where id = p_signoff_id;

  return v_hash;
end;
$$;

-- REVOKE FROM PUBLIC does not touch anon/authenticated, so name all three,
-- after the CREATE. search_results_state is only called by the functions
-- above, which run as the owner.
revoke all on function public.search_results_state(public.search_orders) from public, anon, authenticated;
revoke all on function public.my_search_signoff_role(text) from public, anon, authenticated;
revoke all on function public.transaction_search_status(text) from public, anon, authenticated;
revoke all on function public.sign_off_searches(text, text) from public, anon, authenticated;
revoke all on function public.revoke_search_signoff(uuid, text) from public, anon, authenticated;
grant execute on function public.my_search_signoff_role(text) to authenticated;
grant execute on function public.transaction_search_status(text) to authenticated;
grant execute on function public.sign_off_searches(text, text) to authenticated;
grant execute on function public.revoke_search_signoff(uuid, text) to authenticated;

revoke all on public.search_signoffs from anon;
grant select on public.search_signoffs to authenticated;
