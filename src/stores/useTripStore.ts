import { create } from 'zustand';

type TripState = {
  activeTripId: string | null;
  setActiveTripId: (tripId: string | null) => void;
};

export const useTripStore = create<TripState>((set) => ({
  activeTripId: null,
  setActiveTripId: (activeTripId) => set({ activeTripId }),
}));
