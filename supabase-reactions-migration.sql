-- Run once in Supabase SQL Editor to enable shared emoji reactions.
create table if not exists public.photo_reactions (
  id bigint generated always as identity primary key,
  photo_id uuid not null references public.photos(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '🐾', '🥹', '😍')),
  visitor_id text not null,
  created_at timestamptz not null default now(),
  unique (photo_id, visitor_id, emoji)
);

alter table public.photo_reactions enable row level security;

create policy "Anyone can view photo reactions"
on public.photo_reactions for select
using (true);

create policy "Anyone can add a photo reaction"
on public.photo_reactions for insert
with check (true);
