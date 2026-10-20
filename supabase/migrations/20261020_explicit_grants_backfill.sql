-- Explicit grants for the public relations these migrations created without one.
--
-- From 30 Oct 2026 Supabase stops automatically granting Data API access to
-- new public tables, including on rebuilds from migrations (new projects,
-- preview branches, `supabase db reset`). The four tables below (and the view
-- over agent_listings) were created relying on that automatic grant, so a
-- rebuilt database would come up without it.
--
-- Each grant copies production's privileges as read on 2026-10-20 from
-- pg_class.relacl: every role listed held arwdDxtm (= ALL on Postgres 17,
-- including MAINTAIN). On production this is a no-op; on a rebuild it
-- reproduces production. No revokes: tightening is a separate decision.
--
-- The anon grants are copied as-is, not endorsed. RLS is enabled on all four
-- tables and every policy keys on auth.uid(), so anon reads no rows today, but
-- whether anon should hold these privileges at all is an open question.

-- created by 20260823_agent_listings.sql
-- anon: copied from production; RLS policies key on auth.uid(), so anon gets no rows (open question)
grant all on table public.agent_listings to anon, authenticated, service_role;

-- created by 20260823_agent_listings.sql; read by the public listing page
-- anon: public listing page reads published listings before sign-in; write privileges copied from production (the view is a join, so not updatable)
grant all on table public.public_agent_listings to anon, authenticated, service_role;

-- created by 20260824_party_invites.sql
-- anon: copied from production; the only policy keys on auth.uid(), so anon gets no rows (open question)
grant all on table public.party_invites to anon, authenticated, service_role;

-- created by 20260927_search_signoffs.sql, which revokes anon and grants
-- authenticated select only; production holds ALL for authenticated.
grant all on table public.search_signoffs to authenticated, service_role;

-- created by 20261002_device_push_tokens.sql
-- anon: copied from production; RLS policies are authenticated-only, so anon gets no rows (open question)
grant all on table public.device_push_tokens to anon, authenticated, service_role;
