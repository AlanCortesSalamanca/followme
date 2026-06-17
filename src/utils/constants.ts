export const LOCATION_BROADCAST_INTERVAL_MS = 15_000;
export const LOCATION_BATCH_INTERVAL_MS = 60_000;
export const OFFLINE_THRESHOLD_MS = 30_000;
export const MAX_TRIP_PARTICIPANTS = 10;
export const DEFAULT_DISTANCE_ALERT_METERS = 1_000;

export const STATUS_LABELS: Record<string, string> = {
  planned: 'Planeado',
  active: 'Activo',
  paused: 'En pausa',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export const STATUS_COLORS: Record<string, string> = {
  planned: '#F59E0B',
  active: '#22C55E',
  paused: '#F97316',
  completed: '#64748B',
  cancelled: '#EF4444',
};
