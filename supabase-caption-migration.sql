-- Run this once in the Supabase SQL Editor to store captions for new photos.
-- Existing photos remain unchanged and will use the timeline's default caption.
alter table public.photos
add column if not exists caption text;
