import { supabase } from './client';

export type Trip = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  invite_code: string;
  max_participants: number;
  status: 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

export type Participant = {
  id: string;
  trip_id: string;
  user_id: string;
  role: 'leader' | 'member';
  color: string;
  joined_at: string;
  left_at: string | null;
  display_name?: string;
  avatar_url?: string | null;
};

export function normalizeInviteCode(inviteCode: string): string {
  return inviteCode.trim().toUpperCase();
}

export async function createTrip(creatorId: string, title: string, description = '') {
  const { data, error } = await supabase
    .from('trips')
    .insert({
      creator_id: creatorId,
      title,
      description,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('trip_participants').insert({
    trip_id: data.id,
    user_id: creatorId,
    role: 'leader',
  });

  return data as Trip;
}

export async function getUserTrips(userId: string): Promise<Trip[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from('trip_participants')
    .select('trip_id')
    .eq('user_id', userId)
    .is('left_at', null);
  if (membershipError) throw membershipError;

  const tripIds = memberships?.map((membership) => membership.trip_id) ?? [];
  const visibilityFilter = tripIds.length > 0
    ? `creator_id.eq.${userId},id.in.(${tripIds.join(',')})`
    : `creator_id.eq.${userId}`;

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .or(visibilityFilter)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTripById(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();
  if (error) return null;
  return data;
}

export async function getTripParticipants(tripId: string): Promise<Participant[]> {
  const { data: participants, error } = await supabase
    .from('trip_participants')
    .select('*, profiles!user_id(display_name, avatar_url)')
    .eq('trip_id', tripId);
  if (error) throw error;

  return (participants ?? []).map((p: any) => ({
    id: p.id,
    trip_id: p.trip_id,
    user_id: p.user_id,
    role: p.role,
    color: p.color,
    joined_at: p.joined_at,
    left_at: p.left_at,
    display_name: p.profiles?.display_name ?? 'Desconocido',
    avatar_url: p.profiles?.avatar_url ?? null,
  }));
}

export async function joinTripByCode(inviteCode: string, userId: string): Promise<Trip> {
  const normalizedInviteCode = normalizeInviteCode(inviteCode);
  const { data: trip, error: findError } = await supabase
    .from('trips')
    .select('*')
    .eq('invite_code', normalizedInviteCode)
    .in('status', ['planned', 'active'])
    .single();
  if (findError) throw new Error('Codigo invalido o viaje no disponible');
  if (!trip) throw new Error('Codigo invalido o viaje no disponible');

  const { data: existing } = await supabase
    .from('trip_participants')
    .select('id')
    .eq('trip_id', trip.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) throw new Error('Ya eres miembro de este viaje');

  const { count } = await supabase
    .from('trip_participants')
    .select('*', { count: 'exact', head: true })
    .eq('trip_id', trip.id);
  if (count && count >= trip.max_participants) {
    throw new Error('El viaje ha alcanzado el maximo de participantes');
  }

  const colors = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#A855F7', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'];
  const colorIndex = count ?? 0;
  const color = colors[colorIndex % colors.length];

  const { error: joinError } = await supabase
    .from('trip_participants')
    .insert({ trip_id: trip.id, user_id: userId, role: 'member', color });
  if (joinError) throw new Error('Error al unirse al viaje');

  return trip as Trip;
}

export async function updateTripStatus(tripId: string, status: Trip['status']) {
  const now = new Date().toISOString();
  const updates: Partial<Pick<Trip, 'status' | 'started_at' | 'ended_at'>> = { status };

  if (status === 'active') updates.started_at = now;
  if (status === 'completed' || status === 'cancelled') updates.ended_at = now;

  const { error } = await supabase
    .from('trips')
    .update(updates)
    .eq('id', tripId);
  if (error) throw error;
}

export async function leaveTrip(tripId: string, userId: string) {
  const { error } = await supabase
    .from('trip_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeParticipant(tripId: string, userId: string) {
  const { error } = await supabase
    .from('trip_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}
