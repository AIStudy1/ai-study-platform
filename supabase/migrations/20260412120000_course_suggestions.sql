-- Course suggestions linked to agent chats (run via Supabase CLI or SQL editor).
-- Adjust FKs if your project already links user_id differently.

create table if not exists public.course_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  conversation_id uuid,
  agent_id text not null,
  topic text not null,
  level text not null default 'beginner',
  status text not null default 'pending',
  course_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_suggestions_user_id_idx on public.course_suggestions (user_id);
create index if not exists course_suggestions_user_status_idx on public.course_suggestions (user_id, status);

alter table public.course_suggestions enable row level security;

drop policy if exists "course_suggestions_select_own" on public.course_suggestions;
create policy "course_suggestions_select_own"
  on public.course_suggestions for select
  using (auth.uid() = user_id);

drop policy if exists "course_suggestions_insert_own" on public.course_suggestions;
create policy "course_suggestions_insert_own"
  on public.course_suggestions for insert
  with check (auth.uid() = user_id);

drop policy if exists "course_suggestions_update_own" on public.course_suggestions;
create policy "course_suggestions_update_own"
  on public.course_suggestions for update
  using (auth.uid() = user_id);
