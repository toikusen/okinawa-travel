-- Replace direct RLS-gated insert with a SECURITY DEFINER RPC.
-- This sidesteps auth.email() unreliability in PostgREST by reading
-- the member's email from auth.users via auth.uid() (sub claim, always reliable).

create or replace function public.join_trip_rpc(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email        text;
  v_display_name text;
  v_avatar_url   text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select
    email,
    coalesce(raw_user_meta_data->>'full_name', ''),
    coalesce(raw_user_meta_data->>'avatar_url', '')
  into v_email, v_display_name, v_avatar_url
  from auth.users
  where id = auth.uid();

  if v_email is null then
    return false;
  end if;

  if not exists (select 1 from trips where id = p_trip_id) then
    return false;
  end if;

  insert into trip_members (trip_id, user_email, display_name, avatar_url)
  values (p_trip_id, v_email, v_display_name, v_avatar_url)
  on conflict (trip_id, user_email) do nothing;

  return true;
exception when others then
  return false;
end;
$$;
