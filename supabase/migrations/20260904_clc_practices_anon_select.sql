-- Let the pre-signup CLC lookup actually read the CLC register.
--
-- THE BUG: clc_practices had exactly one policy,
-- clc_practices_select_authenticated, granted to `authenticated`. But the
-- lookup it exists to serve runs on step 1 of /register/conveyancer — before
-- the account exists, so before there is any session. That request is `anon`,
-- `anon` had no policy at all, and RLS therefore returned zero rows for every
-- firm, including firms sitting in the table with status 'Active'.
--
-- It failed silently in the worst way: the page has a deliberate fallback for
-- a firm missing from our snapshot of the register ("continue unverified,
-- checked manually within 24 hours"), so sign-up still completed and nobody
-- saw an error. Every conveyancer who ever registered was routed into the
-- manual verification queue regardless of whether their firm was found.
-- Confirmed 2026-09-04 through the real form (a genuinely Active CLC ID,
-- 11097, came back "not found") and directly against PostgREST with the anon
-- key, which returned Content-Range */0 for the whole table with no filter.
--
-- src/services/clc.service.ts has always documented the intended posture —
-- "RLS on clc_practices allows read to anon + authenticated" — so this makes
-- the database match the contract the code already claimed.
--
-- On exposure: this is the Council for Licensed Conveyancers' public register,
-- republished by the CLC at clc-uk.org. The rows are regulated-practice
-- details (firm name, office address, switchboard, practice email, licence
-- status), not personal data about individuals, and anon can already reach
-- the same facts on the CLC's own site. Nothing here is confidential; a single
-- policy for both roles states that plainly rather than leaving two policies
-- to reason about.
drop policy if exists clc_practices_select_authenticated on public.clc_practices;

create policy clc_practices_select_public on public.clc_practices
  for select
  to anon, authenticated
  using (true);
