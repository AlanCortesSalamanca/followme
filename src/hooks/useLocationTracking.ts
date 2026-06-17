import { useRef, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from '@/services/supabase/client';
import { LocationPayload } from '@/types/location';
import { LOCATION_BROADCAST_INTERVAL_MS, LOCATION_BATCH_INTERVAL_MS } from '@/utils/constants';

type ParticipantLocation = {
  userId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  bearing: number | null;
  recordedAt: string;
  isOnline: boolean;
};

type LocationBatchItem = {
  trip_id: string;
  user_id: string;
  location: string;
  accuracy: number | null;
  speed: number | null;
  bearing: number | null;
  altitude: number | null;
  is_moving: boolean;
  recorded_at: string;
};

export function useLocationTracking(tripId: string | null, userId: string | undefined) {
  const [myLocation, setMyLocation] = useState<LocationPayload | null>(null);
  const [participants, setParticipants] = useState<Record<string, ParticipantLocation>>({});
  const queueRef = useRef<LocationBatchItem[]>([]);

  useEffect(() => {
    if (!tripId || !userId) return;

    let isMounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;
    const queue = queueRef.current;

    const channel = supabase.channel(`trip:${tripId}:locations`, {
      config: { private: true, broadcast: { self: true, ack: false }, presence: { key: userId } },
    });

    const startLocationTracking = async () => {
      if (locationSubscription) return;

      const { status: perm } = await Location.getForegroundPermissionsAsync();
      if (!isMounted || perm !== 'granted') return;

      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: LOCATION_BROADCAST_INTERVAL_MS, distanceInterval: 20 },
        (loc) => {
          if (!Number.isFinite(loc.coords.latitude) || !Number.isFinite(loc.coords.longitude)) return;

          const recordedAt = new Date().toISOString();
          const payload: LocationPayload = {
            tripId,
            userId,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
            speed: loc.coords.speed,
            bearing: loc.coords.heading,
            recordedAt,
          };
          setMyLocation(payload);

          try {
            channel.send({ type: 'broadcast', event: 'location', payload });
          } catch (err) {
            console.error('[useLocationTracking] Broadcast failed:', err);
          }

          queue.push({
            trip_id: tripId,
            user_id: userId,
            location: `POINT(${loc.coords.longitude} ${loc.coords.latitude})`,
            accuracy: loc.coords.accuracy,
            speed: loc.coords.speed,
            bearing: loc.coords.heading,
            altitude: loc.coords.altitude,
            is_moving: (loc.coords.speed ?? 0) > 1,
            recorded_at: recordedAt,
          });
        }
      );

      if (!isMounted) {
        subscription.remove();
        return;
      }

      locationSubscription = subscription;
    };

    channel
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        const p = payload as LocationPayload;
        setParticipants((prev) => ({
          ...prev,
          [p.userId || '']: {
            userId: p.userId || '',
            latitude: p.latitude,
            longitude: p.longitude,
            speed: p.speed ?? null,
            bearing: p.bearing ?? null,
            recordedAt: p.recordedAt,
            isOnline: true,
          },
        }));
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set(Object.keys(state));
        setParticipants((prev) => {
          const next = { ...prev };
          for (const pid of Object.keys(next)) {
            next[pid].isOnline = onlineIds.has(pid);
          }
          return next;
        });
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setParticipants((prev) => ({ ...prev, [key]: { ...prev[key], isOnline: true } }));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setParticipants((prev) => ({ ...prev, [key]: { ...prev[key], isOnline: false } }));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void startLocationTracking();
        }
      });

    const batchTimer = setInterval(async () => {
      if (queue.length === 0) return;
      const batch = queue.splice(0, 20);
      try {
        await supabase.from('location_updates').insert(batch);
      } catch (err) {
        console.error('[useLocationTracking] Batch insert failed:', err);
        queue.unshift(...batch);
      }
    }, LOCATION_BATCH_INTERVAL_MS);

    return () => {
      isMounted = false;
      locationSubscription?.remove();
      if (queue.length > 0) {
        const remaining = queue.splice(0);
        void supabase.from('location_updates').insert(remaining);
      }
      supabase.removeChannel(channel);
      clearInterval(batchTimer);
    };
  }, [tripId, userId]);

  return { myLocation, participants };
}
