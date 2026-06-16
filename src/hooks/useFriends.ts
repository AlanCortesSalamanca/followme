import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  searchUsers,
  sendFriendRequest,
  getPendingRequests,
  getSentRequests,
  respondToRequest,
  getFriends,
  removeFriend,
  UserSearchResult,
  Friend,
  FriendRequest,
} from '@/services/supabase/friends';
import { supabase } from '@/services/supabase/client';

export function useFriends() {
  const { session } = useAuthStore();
  const userId = session?.user.id;

  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getFriends(userId);
      setFriends(data);
    } catch {
      // silently fail
    }
  }, [userId]);

  const loadRequests = useCallback(async () => {
    if (!userId) return;
    try {
      const [pending, sent] = await Promise.all([
        getPendingRequests(userId),
        getSentRequests(userId),
      ]);
      setPendingRequests(pending);
      setSentRequests(sent);
    } catch {
      // silently fail
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    Promise.all([loadFriends(), loadRequests()]).finally(() => setIsLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('friend_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${userId}`,
        },
        () => loadRequests()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: `user_id_1=eq.${userId}`,
        },
        () => loadFriends()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: `user_id_2=eq.${userId}`,
        },
        () => loadFriends()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleSearch = async (query: string) => {
    if (!userId || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchUsers(query, userId);
      const friendIds = new Set(friends.map((f) => f.friendId));
      const pendingIds = new Set(pendingRequests.map((r) => r.sender_id));
      const sentIds = new Set(sentRequests.map((r) => r.receiver_id));

      setSearchResults(
        results.filter((u) => !friendIds.has(u.id) && !pendingIds.has(u.id) && !sentIds.has(u.id))
      );
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (receiverId: string) => {
    if (!userId) return;
    try {
      await sendFriendRequest(userId, receiverId);
      setSearchResults((prev) => prev.filter((u) => u.id !== receiverId));
      await loadRequests();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRespond = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      setError(null);
      await respondToRequest(requestId, status);
      await Promise.all([loadRequests(), loadFriends()]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!userId) return;
    try {
      await removeFriend(userId, friendId);
      await loadFriends();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return {
    friends,
    pendingRequests,
    sentRequests,
    searchResults,
    isSearching,
    isLoading,
    error,
    searchUsers: handleSearch,
    sendRequest: handleSendRequest,
    respondToRequest: handleRespond,
    removeFriend: handleRemoveFriend,
    clearSearch: () => setSearchResults([]),
    clearError: () => setError(null),
  };
}
