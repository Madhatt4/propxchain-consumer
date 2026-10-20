CREATE TABLE "Gadgets" (id int primary key);
GRANT ALL ON "Gadgets" TO service_role;
-- anon: the public marketing page lists gadgets before sign-in
GRANT SELECT ON public.gadgets TO anon;
grant select on public.gadgets to anon; -- anon: same reason, inline form
