import { create } from 'zustand';
import { Trip } from '@/services/supabase/trips';

type TripState = {
  activeTripId: string | null;
  activeTrip: Trip | null;
  setActiveTrip: (trip: Trip | null) => void;
  isTracking: boolean;
  setTracking: (tracking: boolean) => void;
};

export const useTripStore = create<TripState>((set) => ({
  activeTripId: null,
  activeTrip: null,
  setActiveTrip: (activeTrip) => set({
    activeTrip,
    activeTripId: activeTrip?.id ?? null,
  }),
  isTracking: false,
  setTracking: (isTracking) => set({ isTracking }),
}));
