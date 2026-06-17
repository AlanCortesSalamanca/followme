import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTripStore } from '@/stores/useTripStore';
import { getTripById, updateTripStatus } from '@/services/supabase/trips';
import * as Clipboard from 'expo-clipboard';

export default function TripSettingsScreen() {
  const { session } = useAuthStore();
  const { activeTrip, setActiveTrip, setTracking } = useTripStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const userId = session?.user.id;
  if (!activeTrip) {
    return (
      <View style={styles.center}>
        <Text style={styles.noTrip}>Sin viaje activo</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const isLeader = activeTrip.creator_id === userId;
  const isPlanned = activeTrip.status === 'planned';
  const isActive = activeTrip.status === 'active';
  const isCompleted = activeTrip.status === 'completed' || activeTrip.status === 'cancelled';

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    setError(null);
    try {
      await updateTripStatus(activeTrip.id, newStatus as any);
      const updated = await getTripById(activeTrip.id);
      if (updated) setActiveTrip(updated);
      if (newStatus !== 'active') {
        router.back();
      }
    } catch {
      setError('Error al cambiar estado');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(activeTrip.invite_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{activeTrip.title}</Text>
      <Text style={styles.status}>Estado: {activeTrip.status}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Codigo de invitacion</Text>
        <Pressable onPress={handleCopyCode} style={styles.codeBox}>
          <Text style={styles.codeText}>{activeTrip.invite_code}</Text>
          <Text style={styles.codeHint}>{codeCopied ? 'Copiado!' : 'Tocar para copiar'}</Text>
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isLeader && (
        <View style={styles.actions}>
          {isPlanned && (
            <Pressable
              style={[styles.action, styles.startButton]}
              onPress={() => handleStatusChange('active')}
              disabled={isUpdating}
            >
              {isUpdating ? <ActivityIndicator color="#082F49" /> : <Text style={styles.actionText}>Iniciar viaje</Text>}
            </Pressable>
          )}
          {isActive && (
            <>
              <Pressable
                style={[styles.action, styles.pauseButton]}
                onPress={() => handleStatusChange('paused')}
                disabled={isUpdating}
              >
                {isUpdating ? <ActivityIndicator color="#082F49" /> : <Text style={styles.actionText}>Pausar viaje</Text>}
              </Pressable>
              <Pressable
                style={[styles.action, styles.completeButton]}
                onPress={() => handleStatusChange('completed')}
                disabled={isUpdating}
              >
                {isUpdating ? <ActivityIndicator color="#F8FAFC" /> : <Text style={[styles.actionText, styles.completeText]}>Finalizar viaje</Text>}
              </Pressable>
            </>
          )}
          {!isPlanned && !isActive && !isCompleted && (
            <Pressable
              style={[styles.action, styles.startButton]}
              onPress={() => handleStatusChange('planned')}
              disabled={isUpdating}
            >
              {isUpdating ? <ActivityIndicator color="#082F49" /> : <Text style={styles.actionText}>Reanudar</Text>}
            </Pressable>
          )}
        </View>
      )}

      <Pressable style={styles.detailLink} onPress={() => router.push(`/(tabs)/trips/${activeTrip.id}`)}>
        <Text style={styles.detailLinkText}>Ver detalle del viaje</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  noTrip: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  buttonText: {
    color: '#082F49',
    fontWeight: '700',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 40,
  },
  status: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
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
  codeHint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FECACA',
    fontSize: 14,
  },
  actions: {
    gap: 12,
  },
  action: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#38BDF8',
  },
  pauseButton: {
    backgroundColor: '#F59E0B',
  },
  completeButton: {
    backgroundColor: '#EF4444',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#082F49',
  },
  completeText: {
    color: '#F8FAFC',
  },
  detailLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  detailLinkText: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '600',
  },
});
