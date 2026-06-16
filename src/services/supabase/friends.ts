import { supabase } from './client';

export type UserSearchResult = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

export type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  sender?: UserSearchResult;
  receiver?: UserSearchResult;
};

export type Friend = {
  friendId: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

export async function searchUsers(query: string, currentUserId: string): Promise<UserSearchResult[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .or(`email.ilike.%${query}%,display_name.ilike.%${query}%`)
    .neq('id', currentUserId)
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function sendFriendRequest(senderId: string, receiverId: string) {
  const { error } = await supabase
    .from('friend_requests')
    .insert({ sender_id: senderId, receiver_id: receiverId });
  if (error) throw error;
}

export async function getPendingRequests(userId: string): Promise<(FriendRequest & { sender: UserSearchResult })[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*, sender:profiles!sender_id(id, display_name, avatar_url)')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSentRequests(userId: string): Promise<(FriendRequest & { receiver: UserSearchResult })[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*, receiver:profiles!receiver_id(id, display_name, avatar_url)')
    .eq('sender_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function respondToRequest(requestId: string, status: 'accepted' | 'rejected') {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status })
    .eq('id', requestId)
    .eq('status', 'pending');
  if (error) throw error;

  if (status === 'accepted') {
    const { data: request } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .eq('id', requestId)
      .single();

    if (request) {
      const id1 = request.sender_id < request.receiver_id ? request.sender_id : request.receiver_id;
      const id2 = request.sender_id < request.receiver_id ? request.receiver_id : request.sender_id;
      const { error: upsertError } = await supabase
        .from('friends')
        .upsert({ user_id_1: id1, user_id_2: id2 }, { onConflict: 'user_id_1, user_id_2', ignoreDuplicates: true });
      if (upsertError) throw upsertError;
    }
  }
}

export async function getFriends(userId: string): Promise<Friend[]> {
  const { data: rows, error } = await supabase
    .from('friends')
    .select('user_id_1, user_id_2, created_at')
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const friendIds = rows.map((r: any) => r.user_id_1 === userId ? r.user_id_2 : r.user_id_1);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', friendIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return rows.map((r: any) => {
    const fid = r.user_id_1 === userId ? r.user_id_2 : r.user_id_1;
    const profile = profileMap.get(fid);
    return {
      friendId: fid,
      displayName: profile?.display_name ?? 'Desconocido',
      avatarUrl: profile?.avatar_url ?? null,
      createdAt: r.created_at,
    };
  });
}

export async function removeFriend(userId1: string, userId2: string) {
  const id1 = userId1 < userId2 ? userId1 : userId2;
  const id2 = userId1 < userId2 ? userId2 : userId1;
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('user_id_1', id1)
    .eq('user_id_2', id2);
  if (error) throw error;
}
