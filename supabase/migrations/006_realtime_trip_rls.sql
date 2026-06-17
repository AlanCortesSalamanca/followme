-- Restrict private Realtime trip channels to active trip participants.
-- Requires client channels to be created with config.private = true.

create or replace function public.trip_id_from_realtime_topic(topic text)
returns uuid
language sql
immutable
as $$
  select case
    when topic ~ '^trip:[0-9a-fA-F-]{36}:(locations|presence)$'
      then split_part(topic, ':', 2)::uuid
    else null
  end;
$$;

create policy "Trip members can access trip realtime channels"
  on realtime.messages for select to authenticated
  using (
    extension in ('broadcast', 'presence')
    and public.trip_id_from_realtime_topic(topic) is not null
    and exists (
      select 1
      from public.trip_participants
      where trip_id = public.trip_id_from_realtime_topic(topic)
        and user_id = (select auth.uid())
        and left_at is null
    )
  );
