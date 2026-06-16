create extension if not exists postgis;
create extension if not exists pgcrypto;

create or replace function public.nanoid(size int default 8)
returns text
language sql
as $$
  select string_agg(
    substring('abcdefghijklmnopqrstuvwxyz0123456789' from (floor(random() * 36)::int + 1) for 1),
    ''
  )
  from generate_series(1, size);
$$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
