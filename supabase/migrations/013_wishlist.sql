-- 013_wishlist.sql
-- Wishlist: places collected while planning, before they belong to a day.
--
-- Modelled as an event with no day rather than its own table: same columns,
-- same trip_id-based RLS (001), and the existing sheet / card / reorder code
-- works on it unchanged. Scheduling one is an UPDATE of day_id.
--
-- Days cascade-delete their events (001); wishlist rows have no day, so they
-- survive date changes and are only removed with the trip itself.

alter table events alter column day_id drop not null;
