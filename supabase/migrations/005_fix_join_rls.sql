-- auth.email() reads from JWT claims, which may not include the email field
-- in newer Supabase configurations. Use a SECURITY DEFINER function to query
-- auth.users directly via auth.uid() (sub claim, always present).

create or replace function public.get_auth_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from auth.users where id = auth.uid()
$$;

drop policy if exists "trip_members_join" on trip_members;

create policy "trip_members_join" on trip_members
  for insert to authenticated
  with check (public.get_auth_email() = user_email);
