import { useEffect, useState, useCallback } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { getUserTrips, Trip } from '@/services/supabase/trips';
import { supabase } from '@/services/supabase/client';

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planeado',
  active: 'Activo',
  paused: 'En pausa',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  planned: '#F59E0B',
  active: '#22C55E',
  paused: '#F97316',
  completed: '#64748B',
  cancelled: '#EF4444',
};

export default function TripsScreen() {
  const { session } = useAuthStore();
  const userId = session?.user.id;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrips = useCallback(async () => {
    if (!userId) return;
    const data = await getUserTrips(userId);
    setTrips(data);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    loadTrips().finally(() => setIsLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('trip_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, loadTrips)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_participants', filter: `user_id=eq.${userId}` }, loadTrips)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrips();
    setRefreshing(false);
  };

  const active = trips.filter((t) => t.status === 'active');
  const planned = trips.filter((t) => t.status === 'planned' || t.status === 'paused');
  const past = trips.filter((t) => t.status === 'completed' || t.status === 'cancelled');

  const renderTrip = (trip: Trip) => (
    <Pressable
      key={trip.id}
      style={styles.card}
      onPress={() => router.push(`/(tabs)/trips/${trip.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{trip.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[trip.status] }]}>
          <Text style={styles.statusText}>{STATUS_LABELS[trip.status]}</Text>
        </View>
      </View>
      {trip.description ? (
        <Text style={styles.cardDesc} numberOfLines={1}>{trip.description}</Text>
      ) : null}
      <Text style={styles.cardMeta}>
        Codigo: {trip.invite_code} · Max: {trip.max_participants}
      </Text>
    </Pressable>
  );

  const renderSection = (title: string, items: Trip[], emptyMsg: string) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>{emptyMsg}</Text>
      ) : (
        items.map(renderTrip)
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerButtons}>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/(tabs)/trips/create')}>
          <Text style={styles.primaryButtonText}>+ Crear viaje</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/(tabs)/trips/join')}>
          <Text style={styles.secondaryButtonText}>Unirse</Text>
        </Pressable>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => 'placeholder'}
        renderItem={null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={() => (
          <>
            {renderSection('Activos', active, 'No tienes viajes activos.')}
            {renderSection('Planeados', planned, 'No tienes viajes planeados.')}
            {renderSection('Pasados', past, 'No tienes viajes pasados.')}
          </>
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
  headerButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#38BDF8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#082F49',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  statusText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
  cardDesc: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  cardMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 6,
  },
});
