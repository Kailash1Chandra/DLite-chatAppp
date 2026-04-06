-- ============================================================================
-- D-Lite Chat Application PostgreSQL Schema
-- ============================================================================
-- This schema is designed for Supabase PostgreSQL.
-- It supports:
-- - user profiles
-- - direct chats
-- - group chats
-- - chat messages
-- - chat membership
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  username text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group')),
  name text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (chat_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  type text not null default 'text' check (type in ('text', 'image', 'video', 'file', 'audio')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index if not exists idx_chats_created_by on public.chats(created_by);
create index if not exists idx_chats_type on public.chats(type);

create index if not exists idx_group_members_chat_id on public.group_members(chat_id);
create index if not exists idx_group_members_user_id on public.group_members(user_id);

create index if not exists idx_messages_chat_id_created_at
  on public.messages(chat_id, created_at desc);

create index if not exists idx_messages_sender_id on public.messages(sender_id);
create index if not exists idx_messages_created_at on public.messages(created_at desc);
