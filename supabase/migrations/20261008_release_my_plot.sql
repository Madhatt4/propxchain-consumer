-- A buyer who claimed a developer plot can now leave the deal it made
-- (transaction_manager.leaveTransaction, access matrix 2026-10-08). The plot
-- has to come free with them, or it stays reserved against a deal with no
-- buyer. The buyer has no write access to `plots`, so, like claim_plot, the
-- release goes through the server, and only for their own reservation.
-- plots_rotate_code_on_release issues a fresh invite code, so the old one
-- stops working.
create or replace function public.release_my_plot(p_transaction_id text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plot uuid;
begin
  if v_uid is null then
    raise exception 'sign in to release a plot' using errcode = '28000';
  end if;

  update public.plots
  set reservation_status = 'available',
      reserved_by_buyer_user_id = null,
      reserved_at = null,
      reserved_for_email = null,
      transaction_id = null,
      last_error = null
  where transaction_id = p_transaction_id
    and reserved_by_buyer_user_id = v_uid
    and reservation_status = 'reserved'
  returning id into v_plot;

  -- Null when there was nothing of theirs to release (already released, or
  -- not their plot): leaving the deal is still fine.
  return v_plot;
end;
$$;

revoke all on function public.release_my_plot(text) from public, anon, authenticated;
grant execute on function public.release_my_plot(text) to authenticated;
