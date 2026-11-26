-- The site reads and writes the database only from its own server, through a direct
-- Postgres connection. Supabase's public Data API (PostgREST) is not used, so the API
-- roles get no access to the app's tables. RLS (enabled on every table, with no
-- policies) already blocks them; this removes the grants as well.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Tables created by later migrations get no automatic grants either.
alter default privileges for role postgres in schema public
	revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
	revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
	revoke execute on functions from anon, authenticated;
