import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { getFriends, getPendingRequests, removeFriend, Friend } from '@/services/supabase/friends';
import { supabase } from '@/services/supabase/client';

export default function FriendsScreen() {
  const { session } = useAuthStore();
  const userId = session?.user.id;
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!userId) return;
    const [f, p] = await Promise.all([
      getFriends(userId),
      getPendingRequests(userId),
    ]);
    setFriends(f);
    setPendingCount(p.length);
  };

  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    loadData().finally(() => setIsLoading(false));

    const channel = supabase
      .channel('social_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends', filter: `user_id_1=eq.${userId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${userId}` }, loadData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleRemove = async (friendId: string) => {
    if (!userId) return;
    try {
      await removeFriend(userId, friendId);
      await loadData();
    } catch (e: unknown) {
      console.error('[FriendsScreen] Failed to remove friend:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.addButton} onPress={() => router.push('/(tabs)/social/add')}>
          <Text style={styles.addButtonText}>+ Agregar amigo</Text>
        </Pressable>
        <Pressable style={styles.requestsButton} onPress={() => router.push('/(tabs)/social/requests')}>
          <Text style={styles.requestsButtonText}>
            Solicitudes {pendingCount > 0 && `(${pendingCount})`}
          </Text>
        </Pressable>
      </View>

      {friends.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Sin amigos aun</Text>
          <Text style={styles.emptySubtitle}>Agrega amigos para invitarlos a tus viajes.</Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.friendId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.friendCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.friendName}>{item.displayName}</Text>
              <Pressable onPress={() => handleRemove(item.friendId)} style={styles.removeButton}>
                <Text style={styles.removeText}>Eliminar</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#38BDF8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#082F49',
    fontWeight: '700',
    fontSize: 14,
  },
  requestsButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  requestsButtonText: {
    color: '#38BDF8',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  friendName: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '500',
  },
});
