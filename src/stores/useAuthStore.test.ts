import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './useAuthStore';
import { getProfile, signIn, signOut } from '@/services/supabase/auth';

vi.mock('@/services/supabase/auth', () => ({
  getProfile: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
}));

const initialState = useAuthStore.getState();

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(initialState, true);
  });

  it('initializes with profile when session exists', async () => {
    const session = { user: { id: 'user-1' } };
    const profile = { id: 'user-1', display_name: 'User One' };
    vi.mocked(getProfile).mockResolvedValue(profile as never);

    await useAuthStore.getState().initialize(session as never);

    expect(getProfile).toHaveBeenCalledWith('user-1');
    expect(useAuthStore.getState().session).toBe(session);
    expect(useAuthStore.getState().profile).toBe(profile);
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });

  it('stores auth errors on failed sign in', async () => {
    vi.mocked(signIn).mockRejectedValue(new Error('Invalid login'));

    await useAuthStore.getState().signIn('user@example.com', 'password');

    expect(useAuthStore.getState().error).toBe('Invalid login');
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('clears session and profile on sign out', async () => {
    vi.mocked(signOut).mockResolvedValue(undefined as never);
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never, profile: { id: 'user-1' } as never });

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
  });
});
