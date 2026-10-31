-- M01: foundation — private helper schema, deny-by-default privileges and
-- immutable validation helpers used by row-local CHECK constraints.
-- backend_schema.md sections 2, 2.1 and 11.

-- Private helpers are never reachable through the Data API.
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- Supabase grants API roles ALL on new public objects by default. Remove that so
-- every table, sequence and function starts with no access; grants are added
-- explicitly, per object, when a feature is exposed.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges revoke execute on functions from public;

-- updated_at is database-maintained, never client supplied.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Lowercase ASCII letters/digits with internal single hyphens, 3..max_len chars.
create function private.is_slug(value text, max_len integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(value) between 3 and max_len,
    false
  );
$$;

-- HTTPS URL, at most 2,048 characters. Never fetched automatically.
create function private.is_https_url(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(value ~ '^https://[^[:space:]]+$' and char_length(value) <= 2048, false);
$$;

-- Immutable Storage key: <prefix>/<uuid>.<jpg|png|webp>.
create function private.is_image_object_path(path text, prefix text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    path ~ (
      '^' || prefix
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    ),
    false
  );
$$;

-- Exactly {"version": <integer>, "social": bool, "community": bool, "messages": bool}.
create function private.is_valid_notification_preferences(prefs jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(prefs) = 'object'
    and (prefs - array['version', 'social', 'community', 'messages']) = '{}'::jsonb
    and jsonb_typeof(prefs -> 'version') = 'number'
    and (prefs ->> 'version') ~ '^[0-9]+$'
    and jsonb_typeof(prefs -> 'social') = 'boolean'
    and jsonb_typeof(prefs -> 'community') = 'boolean'
    and jsonb_typeof(prefs -> 'messages') = 'boolean',
    false
  );
$$;

-- 0..5 distinct verification evidence keys under the request's own prefix.
create function private.is_valid_evidence_paths(
  paths jsonb,
  organisation_id uuid,
  request_id uuid
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  prefix text := 'organisations/' || organisation_id::text || '/requests/' || request_id::text;
  item jsonb;
  seen text[] := '{}';
begin
  if jsonb_typeof(paths) is distinct from 'array' or jsonb_array_length(paths) > 5 then
    return false;
  end if;
  for item in select value from jsonb_array_elements(paths) loop
    if jsonb_typeof(item) <> 'string'
      or not private.is_image_object_path(item #>> '{}', prefix)
      or (item #>> '{}') = any (seen) then
      return false;
    end if;
    seen := seen || (item #>> '{}');
  end loop;
  return true;
end;
$$;

-- JSON object no larger than max_bytes when serialised.
create function private.is_bounded_object(value jsonb, max_bytes integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_typeof(value) = 'object' and octet_length(value::text) <= max_bytes, false);
$$;
