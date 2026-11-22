-- Allow logged-in users to read profiles (RLS policies still limit which rows).
-- No insert/update/delete grant: roles can only be changed from the database.
grant select on public.profiles to authenticated;