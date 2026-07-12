-- 010_update_own_member.sql
-- Let members rename themselves: update display_name on their own
-- trip_members rows (used by the account settings on the home page).

drop policy if exists "trip_members_update_own" on trip_members;

create policy "trip_members_update_own" on trip_members
  for update
  using (user_email = public.get_auth_email())
  with check (user_email = public.get_auth_email());

-- Column-level grant: display_name only. Without this, the policy could be
-- used to rewrite trip_id and move a membership row into another trip,
-- bypassing the join flow (same pattern as the trips grant in 008).
revoke update on table trip_members from anon, authenticated;
grant update (display_name) on table trip_members to authenticated;
