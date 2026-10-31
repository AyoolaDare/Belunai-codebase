-- Local-only stand-in for objects Supabase provisions before user migrations.
-- Applied to throwaway test databases; NEVER applied to a Supabase project.
-- Mirrors Supabase's API roles, auth.users/auth.uid() and its default
-- public-schema grants, so deny-by-default migrations are tested against the
-- same starting privileges a real project has.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema if not exists extensions;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Newer Supabase projects ship an event trigger that enables RLS on every new
-- public table. Its function is SECURITY DEFINER in public and, through the
-- default grants above, executable by anon/authenticated. M01 revokes that.
create function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
      and schema_name = 'public'
  loop
    execute format('alter table if exists %s enable row level security', cmd.object_identity);
  end loop;
end;
$$;
create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();
