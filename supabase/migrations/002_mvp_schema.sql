create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null check (char_length(display_name) >= 2),
  avatar_url text,
  phone_number text,
  is_onboarded boolean default false,
  location_sharing boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (sender_id, receiver_id),
  check (sender_id <> receiver_id)
);

create trigger trg_friend_requests_updated_at
  before update on public.friend_requests
  for each row execute function public.update_updated_at_column();

create table public.friends (
  user_id_1 uuid not null references public.profiles(id) on delete cascade,
  user_id_2 uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id_1, user_id_2),
  check (user_id_1 < user_id_2)
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) >= 3),
  description text default '',
  origin geography(point, 4326),
  destination geography(point, 4326),
  invite_code text not null unique default public.nanoid(8),
  max_participants integer default 10 check (max_participants between 2 and 10),
  max_distance integer default 1000,
  status text not null default 'planned' check (status in ('planned', 'active', 'paused', 'completed', 'cancelled')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger trg_trips_updated_at
  before update on public.trips
  for each row execute function public.update_updated_at_column();

create table public.trip_participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  color text default '#3B82F6',
  joined_at timestamptz default now(),
  left_at timestamptz,
  unique (trip_id, user_id)
);

create table public.location_updates (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  location geography(point, 4326) not null,
  accuracy real,
  speed real,
  bearing real,
  altitude real,
  is_moving boolean default true,
  recorded_at timestamptz not null,
  created_at timestamptz default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  type text not null check (type in ('distance_exceeded', 'participant_left', 'participant_joined', 'connection_lost', 'long_stop')),
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  subject_user_id uuid references public.profiles(id) on delete set null,
  triggered_by_id uuid references public.profiles(id) on delete set null,
  location geography(point, 4326),
  message text not null,
  data jsonb default '{}',
  is_read boolean default false,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create index idx_profiles_email on public.profiles(email);
create index idx_friend_requests_receiver on public.friend_requests(receiver_id, status);
create index idx_friend_requests_sender on public.friend_requests(sender_id, status);
create index idx_friends_user1 on public.friends(user_id_1);
create index idx_friends_user2 on public.friends(user_id_2);
create index idx_trips_creator on public.trips(creator_id);
create index idx_trips_status on public.trips(status);
create index idx_trips_invite_code on public.trips(invite_code) where status in ('planned', 'active');
create index idx_trip_participants_trip on public.trip_participants(trip_id);
create index idx_trip_participants_user on public.trip_participants(user_id);
create index idx_location_updates_trip_time on public.location_updates(trip_id, recorded_at desc);
create index idx_location_updates_loc on public.location_updates using gist(location);
create index idx_alerts_trip on public.alerts(trip_id, created_at desc);
