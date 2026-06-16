import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPendingRequests, respondToRequest, FriendRequest, UserSearchResult } from '@/services/supabase/friends';
import { supabase } from '@/services/supabase/client';

export default function FriendRequestsScreen() {
  const { session } = useAuthStore();
  const userId = session?.user.id;
  const [requests, setRequests] = useState<(FriendRequest & { sender: UserSearchResult })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = async () => {
    if (!userId) return;
    const data = await getPendingRequests(userId);
    setRequests(data as any);
  };

  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    loadRequests().finally(() => setIsLoading(false));

    const channel = supabase
      .channel('friend_requests_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${userId}` }, loadRequests)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleRespond = async (requestId: string, status: 'accepted' | 'rejected') => {
    setError(null);
    try {
      await respondToRequest(requestId, status);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e: any) {
      setError(e.message ?? 'Error al procesar solicitud');
    }
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
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {requests.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Sin solicitudes pendientes</Text>
          <Text style={styles.emptySubtitle}>Las solicitudes apareceran aqui.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.sender.display_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.sender.display_name}</Text>
                <Text style={styles.date}>Solicitud de amistad</Text>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => handleRespond(item.id, 'accepted')} style={styles.acceptButton}>
                  <Text style={styles.acceptText}>Aceptar</Text>
                </Pressable>
                <Pressable onPress={() => handleRespond(item.id, 'rejected')} style={styles.rejectButton}>
                  <Text style={styles.rejectText}>Rechazar</Text>
                </Pressable>
              </View>
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
  },
  errorBox: {
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    padding: 12,
    margin: 16,
  },
  errorText: {
    color: '#FECACA',
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
  },
  card: {
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
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  date: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  acceptText: {
    color: '#052E16',
    fontWeight: '700',
    fontSize: 12,
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rejectText: {
    color: '#F87171',
    fontWeight: '600',
    fontSize: 12,
  },
});
