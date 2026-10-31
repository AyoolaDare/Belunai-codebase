-- M02: identity pair. One Auth UUID maps to one profile and one settings row.
-- Provisioning and onboarding completion operations arrive with BEL-0302.
-- backend_schema.md 4.1, 4.2.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username varchar(30),
  display_name varchar(80),
  bio varchar(500),
  avatar_path text,
  location_label varchar(100),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_check check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  constraint profiles_display_name_check check (display_name ~ '\S'),
  constraint profiles_bio_check check (bio ~ '\S'),
  constraint profiles_location_label_check check (location_label ~ '\S'),
  constraint profiles_avatar_path_check
    check (avatar_path is null or private.is_image_object_path(avatar_path, 'profiles/' || id::text)),
  constraint profiles_onboarding_check
    check (onboarding_completed_at is null or (username is not null and display_name is not null))
);

create unique index profiles_username_lower_key
  on public.profiles (lower(username)) where username is not null;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.account_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  account_status text not null default 'active',
  message_permission text not null default 'friends_only',
  allow_friend_requests boolean not null default true,
  notification_preferences jsonb not null
    default '{"version": 1, "social": true, "community": true, "messages": true}'::jsonb,
  terms_accepted_at timestamptz,
  terms_version varchar(30),
  privacy_notice_version varchar(30),
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_settings_account_status_check
    check (account_status in ('active', 'suspended', 'pending_deletion')),
  constraint account_settings_message_permission_check
    check (message_permission in ('friends_only', 'nobody')),
  constraint account_settings_notification_preferences_check
    check (private.is_valid_notification_preferences(notification_preferences)),
  constraint account_settings_terms_version_check check (terms_version ~ '\S'),
  constraint account_settings_privacy_notice_version_check check (privacy_notice_version ~ '\S'),
  constraint account_settings_terms_pair_check
    check ((terms_accepted_at is null) = (terms_version is null)),
  constraint account_settings_deletion_check
    check ((account_status = 'pending_deletion') = (deletion_requested_at is not null))
);

create trigger account_settings_set_updated_at
  before update on public.account_settings
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.account_settings enable row level security;
revoke all on public.profiles, public.account_settings from anon, authenticated;
