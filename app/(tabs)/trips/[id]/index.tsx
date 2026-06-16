import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View, ActivityIndicator, ScrollView } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTripStore } from '@/stores/useTripStore';
import { getTripById, getTripParticipants, updateTripStatus, leaveTrip, Trip, Participant } from '@/services/supabase/trips';
import * as Clipboard from 'expo-clipboard';

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planeado',
  active: 'Activo',
  paused: 'En pausa',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuthStore();
  const userId = session?.user.id;
  const { setActiveTrip } = useTripStore();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrip = async () => {
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
    loadTrip().finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Viaje no encontrado</Text>
      </View>
    );
  }

  const isLeader = trip.creator_id === userId;
  const isActive = trip.status === 'active';
  const isPlanned = trip.status === 'planned';
  const isCompleted = trip.status === 'completed' || trip.status === 'cancelled';

  const activeParticipants = participants.filter((p) => !p.left_at);
  const canStart = isPlanned && isLeader && activeParticipants.length >= 1;

  const handleAction = async (newStatus: Trip['status']) => {
    setIsUpdating(true);
    setError(null);
    try {
      await updateTripStatus(trip.id, newStatus);
      await loadTrip();
      if (newStatus === 'active') {
        setActiveTrip({ ...trip, status: newStatus });
        router.push('/(tabs)/map');
      }
    } catch {
      setError('Error al cambiar estado');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(trip.invite_code);
  };

  const handleLeave = async () => {
    if (!userId) return;
    setIsUpdating(true);
    try {
      await leaveTrip(trip.id, userId);
      router.back();
    } catch {
      setError('Error al salir del viaje');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{trip.title}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Estado: {STATUS_LABELS[trip.status]}</Text>
        </View>
      </View>

      {trip.description ? (
        <Text style={styles.description}>{trip.description}</Text>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Codigo de invitacion</Text>
        <Pressable onPress={handleCopyCode} style={styles.codeBox}>
          <Text style={styles.codeText}>{trip.invite_code}</Text>
          <Text style={styles.copyHint}>Tocar para copiar</Text>
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Participantes ({activeParticipants.length}/{trip.max_participants})
        </Text>
        {activeParticipants.map((p) => (
          <View key={p.id} style={styles.participantRow}>
            <View style={[styles.dot, { backgroundColor: p.color }]} />
            <Text style={styles.participantName}>{p.display_name ?? 'Desconocido'}</Text>
            {p.role === 'leader' && <Text style={styles.leaderBadge}>Lider</Text>}
          </View>
        ))}
        <Pressable
          style={styles.viewAllButton}
          onPress={() => router.push(`/(tabs)/trips/${trip.id}/participants`)}
        >
          <Text style={styles.viewAllText}>Ver todos</Text>
        </Pressable>
      </View>

      {isLeader && !isCompleted && (
        <View style={styles.actions}>
          {canStart && (
            <Pressable
              style={[styles.actionButton, styles.startButton]}
              onPress={() => handleAction('active')}
              disabled={isUpdating}
            >
              {isUpdating ? <ActivityIndicator color="#082F49" /> : <Text style={styles.actionButtonText}>Iniciar viaje</Text>}
            </Pressable>
          )}
          {isActive && (
            <Pressable
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => handleAction('completed')}
              disabled={isUpdating}
            >
              {isUpdating ? <ActivityIndicator color="#F8FAFC" /> : <Text style={[styles.actionButtonText, styles.completeButtonText]}>Finalizar viaje</Text>}
            </Pressable>
          )}
        </View>
      )}

      {!isLeader && !isCompleted && (
        <Pressable
          style={[styles.actionButton, styles.leaveButton]}
          onPress={handleLeave}
          disabled={isUpdating}
        >
          {isUpdating ? <ActivityIndicator color="#F87171" /> : <Text style={styles.leaveButtonText}>Salir del viaje</Text>}
        </Pressable>
      )}
    </ScrollView>
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
  header: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  statusRow: {
    marginTop: 8,
  },
  statusLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  description: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  codeBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  codeText: {
    color: '#38BDF8',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
  },
  copyHint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  errorText: {
    color: '#FECACA',
    fontSize: 14,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  participantName: {
    color: '#F8FAFC',
    fontSize: 15,
    flex: 1,
  },
  leaderBadge: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#451A03',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  viewAllButton: {
    marginTop: 8,
    alignSelf: 'center',
  },
  viewAllText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  actionButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#38BDF8',
  },
  completeButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#082F49',
  },
  completeButtonText: {
    color: '#F8FAFC',
  },
  leaveButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#F87171',
    fontSize: 16,
    fontWeight: '700',
  },
});
