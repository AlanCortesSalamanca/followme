export type LocationPayload = {
  tripId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  bearing?: number | null;
  recordedAt: string;
};
