-- transaction_party_roles: a user must always be able to read their OWN rows.
--
-- 20260824_party_roles_read_scope made SELECT depend solely on
-- can_read_transaction_party_roles(transaction_id), i.e. "you already hold a
-- row on this deal". Postgres applies SELECT policies to the proposed row on
-- INSERT ... ON CONFLICT DO UPDATE (PostgREST's upsert), so the FIRST row for
-- any transaction failed with "new row violates row-level security policy".
-- Reproduced 2026-08-25 on Start sale step 2; the wallet join flow's
-- recordMyRole hit the same wall silently.
--
-- Own rows OR deal-scoped rows. Visibility of other parties' rows is unchanged.
drop policy if exists transaction_party_roles_read on public.transaction_party_roles;
create policy transaction_party_roles_read on public.transaction_party_roles
  for select using (
    user_id = (select auth.uid())
    or public.can_read_transaction_party_roles(transaction_id)
  );
