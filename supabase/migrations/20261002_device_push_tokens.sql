-- Phone push tokens for the PropXchain mobile app.
--
-- One row per installed app instance. The app registers its token after the
-- person turns notifications on, and removes it on sign-out. The Move Narrator
-- edge function reads these with the service role to send a push to the
-- person's own phones only; the client never reads another user's tokens.
--
-- A token is a device address issued by Apple/Google through Firebase. It holds
-- no personal data and nothing here is written to the on-chain audit trail.

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint device_push_tokens_token_key unique (token)
);

create index if not exists device_push_tokens_user_id_idx
  on public.device_push_tokens (user_id);

alter table public.device_push_tokens enable row level security;

-- Read and delete your own rows only. There is no insert/update policy: writes
-- go through register_device_push_token() below. The edge function uses the
-- service role, which bypasses RLS.
create policy device_push_tokens_select_own
  on public.device_push_tokens for select
  to authenticated
  using (user_id = auth.uid());

create policy device_push_tokens_delete_own
  on public.device_push_tokens for delete
  to authenticated
  using (user_id = auth.uid());

-- Register this phone for the signed-in user. If the same phone was last used
-- by someone else (shared or handed-on phone), the token moves to the new
-- user: a token can only ever belong to one person at a time.
create or replace function public.register_device_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid platform';
  end if;
  if p_token is null or length(p_token) < 20 or length(p_token) > 4096 then
    raise exception 'invalid token';
  end if;

  insert into public.device_push_tokens (user_id, token, platform)
  values (auth.uid(), p_token, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        last_seen_at = now();
end;
$$;

revoke all on function public.register_device_push_token(text, text) from public, anon;
grant execute on function public.register_device_push_token(text, text) to authenticated;
