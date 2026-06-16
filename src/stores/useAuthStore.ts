import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { Profile, getProfile, signIn, signOut, signUp } from '@/services/supabase/auth';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  initialize: (session: Session | null) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async (session) => {
    if (session) {
      const profile = await getProfile(session.user.id);
      set({ session, profile, isInitialized: true });
    } else {
      set({ session: null, profile: null, isInitialized: true });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await signIn({ email, password });
      const profile = await getProfile(data.session.user.id);
      set({ session: data.session, profile, isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e.message });
    }
  },

  signUp: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      await signUp({ email, password, displayName });
      set({ isLoading: false, error: null });
    } catch (e: any) {
      set({ isLoading: false, error: e.message });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await signOut();
      set({ session: null, profile: null, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
