-- Tighten transaction_party_roles SELECT from qual `true` to transaction-scoped.
--
-- Does NOT reuse or edit public.is_transaction_party() — that function
-- references a table ("TransactionParty") that does not exist in this
-- project and errors on every call; it may also have other consumers we
-- don't want to disturb. This is a new, table-specific helper instead.
--
-- SECURITY DEFINER is required, not incidental: a policy on
-- transaction_party_roles that subqueries transaction_party_roles directly
-- (without bypassing RLS on the inner select) recurses and throws 42P17
-- ("infinite recursion detected in policy"). The function's own SELECT runs
-- as the function owner, sidestepping that.
--
-- Semantics: a caller can read all party rows for any transaction where
-- THEY THEMSELVES have a row (matched by user_id). The estate agent has
-- their own estate_agent row for a sale they started, so they still read
-- the whole party set (ListingPartiesSection keeps working); a seller/buyer
-- reads their co-parties; a stranger with no row for that transaction reads
-- nothing.
create or replace function public.can_read_transaction_party_roles(txn_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.transaction_party_roles r
    where r.transaction_id = txn_id
      and r.user_id = (select auth.uid())
  );
$$;
revoke all on function public.can_read_transaction_party_roles(text) from public;
grant execute on function public.can_read_transaction_party_roles(text) to authenticated, anon;

drop policy if exists transaction_party_roles_read on public.transaction_party_roles;
create policy transaction_party_roles_read on public.transaction_party_roles
  for select using (public.can_read_transaction_party_roles(transaction_id));
