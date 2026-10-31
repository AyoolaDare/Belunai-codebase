-- M11: one-to-one conversations and messages. Participant slots are SET NULL
-- on erasure and never reused; a conversation is deleted before both slots
-- would become NULL. Send/open operations and the sender-participant trigger
-- arrive with P09. backend_schema.md 4.18, 4.19.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid references public.profiles (id) on delete set null,
  user_high_id uuid references public.profiles (id) on delete set null,
  low_read_at timestamptz,
  high_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_pair_key unique (user_low_id, user_high_id),
  constraint conversations_survivor_check check (user_low_id is not null or user_high_id is not null),
  constraint conversations_order_check
    check (user_low_id is null or user_high_id is null or user_low_id < user_high_id)
);

create index conversations_low_idx on public.conversations (user_low_id, updated_at desc, id);
create index conversations_high_idx on public.conversations (user_high_id, updated_at desc, id);

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function private.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body varchar(5000) not null,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint messages_request_key unique (conversation_id, client_request_id),
  constraint messages_body_check check (body ~ '\S')
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc, id desc);
create index messages_sender_idx on public.messages (sender_id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.messages from anon, authenticated;
