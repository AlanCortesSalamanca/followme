export type TripStatus = 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';
export type TripRole = 'leader' | 'member';

export type Trip = {
  id: string;
  title: string;
  description: string;
  status: TripStatus;
  inviteCode: string;
  maxParticipants: number;
};
