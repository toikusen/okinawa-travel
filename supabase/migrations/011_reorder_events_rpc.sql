-- Reordering was N independent UPDATEs with no transaction: a partial failure
-- left the day in a half-sorted state. One statement, one transaction.
-- security invoker keeps the existing events RLS policies in force.

create or replace function public.reorder_events_rpc(p_day_id uuid, p_ids uuid[])
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated int;
begin
  update events e
  set sort_order = ord.position - 1
  from unnest(p_ids) with ordinality as ord(id, position)
  where e.id = ord.id
    and e.day_id = p_day_id;

  get diagnostics v_updated = row_count;
  return v_updated = array_length(p_ids, 1);
end;
$$;

revoke execute on function public.reorder_events_rpc(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_events_rpc(uuid, uuid[]) to authenticated;
