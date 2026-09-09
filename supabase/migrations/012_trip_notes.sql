-- 012_trip_notes.sql
-- Trip-level memo: flight numbers, hotel booking codes, emergency contacts.
-- Until now these had to be smuggled into some event's notes field.

alter table trips add column if not exists notes text not null default '';

-- 008 revoked blanket UPDATE on trips and re-granted column by column, so a
-- new column needs its own grant or members cannot write it.
grant update (notes) on table trips to authenticated;
