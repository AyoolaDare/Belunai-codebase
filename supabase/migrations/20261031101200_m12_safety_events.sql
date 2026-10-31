-- M12: notifications, reports, moderation actions and invitations.
-- Closed polymorphic target pairings are CHECKs here; locked target
-- validation and target-deletion cleanup triggers arrive with P10/P11.
-- backend_schema.md 4.20, 4.21, 4.22, 4.25 and 5.1.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  target_type text not null,
  target_id uuid,
  dedupe_key varchar(200) not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_dedupe_key unique (recipient_id, dedupe_key),
  constraint notifications_dedupe_key_check check (dedupe_key ~ '\S'),
  constraint notifications_event_type_check check (event_type in (
    'follow', 'organisation_post', 'friend_request', 'friend_accepted', 'post_like',
    'post_comment', 'membership_decision', 'message', 'moderation'
  )),
  constraint notifications_target_type_check check (target_type in (
    'profile', 'organisation', 'friendship', 'post', 'comment', 'community', 'conversation', 'report'
  )),
  constraint notifications_pairing_check check (
    case event_type
      when 'follow' then target_type = 'profile'
      when 'organisation_post' then target_type = 'post'
      when 'friend_request' then target_type = 'friendship'
      when 'friend_accepted' then target_type = 'friendship'
      when 'post_like' then target_type = 'post'
      when 'post_comment' then target_type = 'comment'
      when 'membership_decision' then target_type = 'community'
      when 'message' then target_type = 'conversation'
      when 'moderation' then
        target_type in ('report', 'post', 'profile', 'organisation', 'community')
    end
  )
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc, id desc);
create index notifications_unread_idx
  on public.notifications (recipient_id, created_at desc) where read_at is null;
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_target_idx on public.notifications (target_type, target_id);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null,
  target_id uuid,
  reason text not null,
  details varchar(2000),
  status text not null default 'open',
  assigned_to uuid references public.profiles (id) on delete set null,
  resolution_note varchar(2000),
  resolved_at timestamptz,
  evidence_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_reports_target_type_check check (target_type in (
    'profile', 'organisation', 'community', 'post', 'comment', 'message'
  )),
  constraint content_reports_reason_check check (reason in (
    'spam', 'harassment', 'hate', 'sexual_content', 'violence', 'impersonation', 'other'
  )),
  constraint content_reports_details_check check (details ~ '\S'),
  constraint content_reports_resolution_note_check check (resolution_note ~ '\S'),
  constraint content_reports_status_check
    check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  constraint content_reports_terminal_check
    check ((status in ('resolved', 'dismissed')) = (resolved_at is not null)),
  constraint content_reports_evidence_check
    check (private.is_bounded_object(evidence_snapshot, 32768))
);

create unique index content_reports_single_open_key
  on public.content_reports (reporter_id, target_type, target_id)
  where status in ('open', 'in_review') and reporter_id is not null and target_id is not null;
create index content_reports_status_created_idx
  on public.content_reports (status, created_at, id);
create index content_reports_reporter_idx on public.content_reports (reporter_id);
create index content_reports_assigned_idx on public.content_reports (assigned_to);
create index content_reports_target_idx on public.content_reports (target_type, target_id);

create trigger content_reports_set_updated_at
  before update on public.content_reports
  for each row execute function private.set_updated_at();

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.content_reports (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action_type text not null,
  target_type text not null,
  target_id uuid,
  reason varchar(2000) not null,
  created_at timestamptz not null default now(),
  constraint moderation_actions_action_type_check check (action_type in (
    'remove_content', 'restore_content', 'suspend_account', 'restore_account',
    'suspend_entity', 'restore_entity', 'dismiss_report', 'revoke_verification'
  )),
  constraint moderation_actions_target_type_check check (target_type in (
    'profile', 'organisation', 'community', 'post', 'comment', 'message'
  )),
  constraint moderation_actions_reason_check check (reason ~ '\S'),
  constraint moderation_actions_compatibility_check check (
    case action_type
      when 'remove_content' then target_type in ('post', 'comment', 'message')
      when 'restore_content' then target_type in ('post', 'comment', 'message')
      when 'suspend_account' then target_type = 'profile'
      when 'restore_account' then target_type = 'profile'
      when 'suspend_entity' then target_type in ('organisation', 'community')
      when 'restore_entity' then target_type in ('organisation', 'community')
      when 'revoke_verification' then target_type = 'organisation'
      when 'dismiss_report' then true
    end
  )
);

create index moderation_actions_report_idx on public.moderation_actions (report_id);
create index moderation_actions_actor_idx on public.moderation_actions (actor_id);
create index moderation_actions_target_idx
  on public.moderation_actions (target_type, target_id, created_at);

-- Only the SHA-256 digest of a >=256-bit token is stored.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  created_by uuid references public.profiles (id) on delete set null,
  organisation_id uuid references public.organisations (id) on delete cascade,
  community_id uuid references public.communities (id) on delete cascade,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_token_hash_key unique (token_hash),
  constraint invitations_token_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint invitations_scope_check check (organisation_id is null or community_id is null),
  constraint invitations_status_check
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  constraint invitations_expiry_check check (expires_at > created_at),
  constraint invitations_accepted_check check ((status = 'accepted') = (accepted_at is not null)),
  constraint invitations_accepted_by_check check (accepted_by is null or status = 'accepted')
);

create index invitations_status_expiry_idx on public.invitations (status, expires_at);
create index invitations_created_by_idx on public.invitations (created_by);
create index invitations_organisation_idx on public.invitations (organisation_id);
create index invitations_community_idx on public.invitations (community_id);
create index invitations_accepted_by_idx on public.invitations (accepted_by);

alter table public.notifications enable row level security;
alter table public.content_reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.invitations enable row level security;
revoke all on public.notifications, public.content_reports, public.moderation_actions,
  public.invitations from anon, authenticated;
