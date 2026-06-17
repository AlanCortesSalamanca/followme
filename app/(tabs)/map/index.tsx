import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTripStore } from '@/stores/useTripStore';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { getTripById, getTripParticipants } from '@/services/supabase/trips';
import type { Participant } from '@/services/supabase/trips';

const MAP_STYLE = process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? 'https://demotiles.maplibre.org/style.json';

export default function MapScreen() {
  const { session } = useAuthStore();
  const { activeTripId, activeTrip, setActiveTrip } = useTripStore();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userId = session?.user.id;
  const { myLocation, participants: liveParticipants } = useLocationTracking(
    activeTrip?.status === 'active' ? activeTripId : null,
    userId
  );

  useEffect(() => {
    if (!activeTripId) {
      setIsLoading(false);
      return;
    }
    Promise.all([
      getTripById(activeTripId),
      getTripParticipants(activeTripId),
    ]).then(([trip, p]) => {
      if (trip) setActiveTrip(trip);
      setParticipants(p);
      setIsLoading(false);
    });
  }, [activeTripId]);

  useEffect(() => {
    if (!activeTripId) return;
    const interval = setInterval(async () => {
      const trip = await getTripById(activeTripId);
      if (trip) setActiveTrip(trip);
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeTripId]);

  const goToTripDetail = () => {
    if (activeTripId) router.push(`/(tabs)/trips/${activeTripId}`);
  };

  const memberCount = participants.filter((p) => !p.left_at).length;
  const activeLiveCount = Object.values(liveParticipants).filter((p) => p.isOnline).length;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  if (!activeTrip) {
    return (
      <View style={styles.center}>
        <Text style={styles.noTripTitle}>Sin viaje activo</Text>
        <Text style={styles.noTripSubtitle}>Crea o unite a un viaje para comenzar.</Text>
        <Pressable style={styles.goButton} onPress={() => router.push('/(tabs)/trips')}>
          <Text style={styles.goButtonText}>Ver mis viajes</Text>
        </Pressable>
      </View>
    );
  }

  const allMarkers: { id: string; lat: number; lng: number; color: string; label: string; isOnline: boolean }[] = [];
  if (myLocation) {
    const me = participants.find((p) => p.user_id === userId);
    allMarkers.push({
      id: userId!,
      lat: myLocation.latitude,
      lng: myLocation.longitude,
      color: me?.color ?? '#3B82F6',
      label: 'Tu',
      isOnline: true,
    });
  }
  for (const p of participants) {
    const live = liveParticipants[p.user_id];
    if (live && (!myLocation || p.user_id !== userId)) {
      allMarkers.push({
        id: p.user_id,
        lat: live.latitude,
        lng: live.longitude,
        color: p.color,
        label: p.display_name ?? '?',
        isOnline: live.isOnline,
      });
    }
  }

  return (
    <View style={styles.container}>
      <MapLibreGL.Map
        style={{ flex: 1 }}
        mapStyle={MAP_STYLE}
        compass
        logo={false}
      >
        <MapLibreGL.Camera
          initialViewState={
            allMarkers.length > 0
              ? { center: [allMarkers[0].lng, allMarkers[0].lat], zoom: 12 }
              : { center: [-99.13, 19.43], zoom: 5 }
          }
        />

        {allMarkers.map((m) => (
          <MapLibreGL.Marker
            key={m.id}
            id={m.id}
            lngLat={[m.lng, m.lat]}
          >
            <View style={[styles.marker, { backgroundColor: m.isOnline ? m.color : '#64748B' }]}>
              <Text style={styles.markerText}>{m.label.charAt(0).toUpperCase()}</Text>
            </View>
          </MapLibreGL.Marker>
        ))}
      </MapLibreGL.Map>

      <View style={styles.topBar}>
        <View style={styles.tripInfo}>
          <Text style={styles.tripName}>{activeTrip.title}</Text>
          <Text style={styles.tripMeta}>
            {activeLiveCount} en vivo · {memberCount} miembros
          </Text>
        </View>
        <Pressable style={styles.infoButton} onPress={goToTripDetail}>
          <Text style={styles.infoButtonText}>Info</Text>
        </Pressable>
      </View>

      {activeTrip && activeTrip.status === 'active' && (
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>EN VIVO</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0F172A',
  },
  noTripTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  noTripSubtitle: {
    color: '#64748B',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  goButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  goButtonText: {
    color: '#082F49',
    fontWeight: '700',
  },
  topBar: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172AEE',
    borderRadius: 14,
    padding: 14,
  },
  tripInfo: {
    flex: 1,
  },
  tripName: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  tripMeta: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  infoButton: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  infoButtonText: {
    color: '#38BDF8',
    fontWeight: '600',
    fontSize: 13,
  },
  liveIndicator: {
    position: 'absolute',
    top: 120,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F8FAFC',
    marginRight: 6,
  },
  liveText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F8FAFC',
  },
  markerText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
});
