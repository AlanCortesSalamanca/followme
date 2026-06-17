-- ============================================
-- Migration 004: Fix RLS policies, add missing indexes, force RLS
-- ============================================

-- Fix trips UPDATE to allow leaders who aren't creators
drop policy if exists "Leaders can update trips" on public.trips;
create policy "Leaders can update trips"
  on public.trips for update to authenticated
  using (
    creator_id = (select auth.uid())
    or exists (
      select 1 from public.trip_participants
      where trip_id = trips.id and user_id = (select auth.uid()) and role = 'leader'
    )
  )
  with check (
    creator_id = (select auth.uid())
    or exists (
      select 1 from public.trip_participants
      where trip_id = trips.id and user_id = (select auth.uid()) and role = 'leader'
    )
  );

-- Add DELETE policy for friends
create policy "Users can delete own friendships"
  on public.friends for delete to authenticated
  using ((select auth.uid()) in (user_id_1, user_id_2));

-- Allow trip participants to leave (update left_at)
create policy "Users can leave trips"
  on public.trip_participants for update to authenticated
  using (user_id = (select auth.uid()) and left_at is null)
  with check (user_id = (select auth.uid()));

-- Allow leaders to remove participants (update left_at)
create policy "Leaders can remove participants"
  on public.trip_participants for update to authenticated
  using (
    exists (
      select 1 from public.trip_participants tp
      where tp.trip_id = trip_participants.trip_id
        and tp.user_id = (select auth.uid())
        and tp.role = 'leader'
    )
  )
  with check (
    exists (
      select 1 from public.trip_participants tp
      where tp.trip_id = trip_participants.trip_id
        and tp.user_id = (select auth.uid())
        and tp.role = 'leader'
    )
  );

-- Allow participants to create alerts
create policy "Trip members can create alerts"
  on public.alerts for insert to authenticated
  with check (
    exists (
      select 1 from public.trip_participants
      where trip_id = alerts.trip_id and user_id = (select auth.uid())
    )
  );

-- Prevent duplicate active memberships per trip
create unique index if not exists idx_trip_participants_active
  on public.trip_participants(trip_id, user_id)
  where left_at is null;

-- Missing FK indexes
create index if not exists idx_alerts_subject_user on public.alerts(subject_user_id);
create index if not exists idx_alerts_triggered_by on public.alerts(triggered_by_id);
create index if not exists idx_location_updates_user on public.location_updates(user_id, trip_id);

-- Spatial indexes on trips
create index if not exists idx_trips_origin on public.trips using gist(origin);
create index if not exists idx_trips_destination on public.trips using gist(destination);

-- Force RLS on all tables (prevents service_role bypass)
alter table public.profiles force row level security;
alter table public.friend_requests force row level security;
alter table public.friends force row level security;
alter table public.trips force row level security;
alter table public.trip_participants force row level security;
alter table public.location_updates force row level security;
alter table public.alerts force row level security;
