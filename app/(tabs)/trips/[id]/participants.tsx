import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { getTripParticipants, getTripById, removeParticipant, Participant, Trip } from '@/services/supabase/trips';

export default function TripParticipantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuthStore();
  const userId = session?.user.id;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoving, setIsRemoving] = useState(false);

  const load = async () => {
    if (!id) return;
    const [t, p] = await Promise.all([
      getTripById(id),
      getTripParticipants(id),
    ]);
    setTrip(t);
    setParticipants(p);
  };

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [id]);

  const isLeader = trip?.creator_id === userId;
  const active = participants.filter((p) => !p.left_at);

  const handleRemove = async (participantId: string) => {
    setIsRemoving(true);
    await removeParticipant(id!, participantId);
    await load();
    setIsRemoving(false);
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
      <Text style={styles.count}>
        {active.length} de {trip?.max_participants ?? 10} participantes
      </Text>

      <FlatList
        data={active}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <View style={styles.info}>
              <Text style={styles.name}>{item.display_name ?? 'Desconocido'}</Text>
              <Text style={styles.role}>
                {item.role === 'leader' ? 'Lider' : 'Miembro'}
                {item.left_at ? ' (Salio)' : ''}
              </Text>
            </View>
            {isLeader && item.role !== 'leader' && (
              <Pressable
                style={[styles.removeButton, isRemoving && { opacity: 0.5 }]}
                onPress={() => handleRemove(item.user_id)}
                disabled={isRemoving}
              >
                <Text style={styles.removeText}>Expulsar</Text>
              </Pressable>
            )}
          </View>
        )}
      />
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
    backgroundColor: '#0F172A',
  },
  count: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    padding: 16,
    paddingBottom: 8,
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
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  role: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
  },
});
