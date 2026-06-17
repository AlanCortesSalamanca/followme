-- Add pg_trgm extension for efficient user search
create extension if not exists pg_trgm;

-- Reuse existing functions
-- (nanoid and update_updated_at_column are already created in 001)

-- Fix invite code generation to use cryptographically secure random
-- instead of PostgreSQL's non-cryptographic random()
create or replace function public.nanoid(size int default 8)
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
  byte int;
begin
  for i in 1..size loop
    byte := get_byte(gen_random_bytes(1), 0) & 31;
    result := result || substr(chars, byte + 1, 1);
  end loop;
  return result;
end;
$$;

-- Trigram indexes for user search (supports leading-wildcard ILIKE)
create index if not exists idx_profiles_display_name_trgm
  on public.profiles using gin(display_name gin_trgm_ops);
create index if not exists idx_profiles_email_trgm
  on public.profiles using gin(email gin_trgm_ops);

-- Add email NOT NULL constraint
alter table public.profiles alter column email set not null;

-- Note: Realtime Broadcast RLS (restrict channel subscription by trip membership)
-- must be configured in the Supabase Dashboard under Realtime > Realtime RLS Policies.
-- SQL-only approach: create a policy on the realtime.messages table (if exposed).
