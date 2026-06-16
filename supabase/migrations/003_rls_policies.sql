alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friends enable row level security;
alter table public.trips enable row level security;
alter table public.trip_participants enable row level security;
alter table public.location_updates enable row level security;
alter table public.alerts enable row level security;

create policy "Authenticated users can read profiles"
  on public.profiles for select to authenticated using (true);

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can see own friend requests"
  on public.friend_requests for select to authenticated
  using ((select auth.uid()) in (sender_id, receiver_id));

create policy "Users can send friend requests"
  on public.friend_requests for insert to authenticated
  with check ((select auth.uid()) = sender_id and sender_id <> receiver_id);

create policy "Receivers can answer friend requests"
  on public.friend_requests for update to authenticated
  using ((select auth.uid()) = receiver_id and status = 'pending')
  with check ((select auth.uid()) = receiver_id and status in ('accepted', 'rejected'));

create policy "Users can see own friendships"
  on public.friends for select to authenticated
  using ((select auth.uid()) in (user_id_1, user_id_2));

create policy "Users can create accepted friendships"
  on public.friends for insert to authenticated
  with check (
    (select auth.uid()) in (user_id_1, user_id_2)
    and exists (
      select 1 from public.friend_requests
      where status = 'accepted'
        and (
          (sender_id = user_id_1 and receiver_id = user_id_2)
          or (sender_id = user_id_2 and receiver_id = user_id_1)
        )
    )
  );

create policy "Users can see own trips"
  on public.trips for select to authenticated
  using (
    creator_id = (select auth.uid())
    or exists (
      select 1 from public.trip_participants
      where trip_id = trips.id and user_id = (select auth.uid())
    )
  );

create policy "Users can create trips"
  on public.trips for insert to authenticated
  with check (creator_id = (select auth.uid()));

create policy "Leaders can update trips"
  on public.trips for update to authenticated
  using (
    creator_id = (select auth.uid())
    or exists (
      select 1 from public.trip_participants
      where trip_id = trips.id and user_id = (select auth.uid()) and role = 'leader'
    )
  )
  with check (creator_id = (select auth.uid()));

create policy "Trip members can see participants"
  on public.trip_participants for select to authenticated
  using (
    exists (
      select 1 from public.trip_participants tp
      where tp.trip_id = trip_participants.trip_id and tp.user_id = (select auth.uid())
    )
  );

create policy "Users can join trips"
  on public.trip_participants for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      role = 'member'
      or exists (
        select 1 from public.trips
        where trips.id = trip_participants.trip_id
          and trips.creator_id = (select auth.uid())
      )
    )
    and exists (
      select 1 from public.trips
      where trips.id = trip_participants.trip_id
        and trips.status in ('planned', 'active')
        and (
          select count(*)
          from public.trip_participants existing
          where existing.trip_id = trip_participants.trip_id
            and existing.left_at is null
        ) < trips.max_participants
    )
  );

create policy "Trip members can see locations"
  on public.location_updates for select to authenticated
  using (
    exists (
      select 1 from public.trip_participants
      where trip_id = location_updates.trip_id and user_id = (select auth.uid())
    )
  );

create policy "Users can insert own locations"
  on public.location_updates for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.trip_participants
      where trip_id = location_updates.trip_id and user_id = (select auth.uid())
    )
  );

create policy "Trip members can see alerts"
  on public.alerts for select to authenticated
  using (
    exists (
      select 1 from public.trip_participants
      where trip_id = alerts.trip_id and user_id = (select auth.uid())
    )
  );
