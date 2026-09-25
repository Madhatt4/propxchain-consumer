-- party_invites: an estate agent's invitation to a party (seller, buyer,
-- conveyancer, mortgage broker, lender, other) to join a transaction on
-- PropXchain. Writes go through the send-party-invite edge function's
-- service role only — RLS below grants select to the inviting user, no
-- insert/update policies.
create table if not exists public.party_invites (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null,
  invite_code text not null,                       -- on-chain TX-XXXX-XXXX
  listing_id uuid references public.agent_listings(id) on delete set null,
  role text not null check (role in ('seller','buyer','conveyancer','mortgage_broker','lender','other','estate_agent')),
  side text check (side in ('buyer','seller')),
  recipient_name text not null,
  recipient_email text not null,
  invited_by_principal text not null,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists party_invites_tx_idx on public.party_invites(transaction_id);
alter table public.party_invites enable row level security;
create policy party_invites_own_select on public.party_invites for select
  using (invited_by_user_id = (select auth.uid()));
-- no insert/update policies: writes go through the edge fn's service role only
