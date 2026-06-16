import { useEffect } from 'react';
import { Slot, SplashScreen, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/stores/useAuthStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { session, profile, isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialize(session);
      SplashScreen.hideAsync();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      initialize(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login');
    } else {
      const isOnboarded = profile?.is_onboarded ?? false;
      if (!isOnboarded && segments[0] !== '(auth)') {
        router.replace('/(auth)/onboarding');
      } else if (isOnboarded && inAuthGroup) {
        router.replace('/(tabs)/trips');
      }
    }
  }, [session, profile, isInitialized, segments]);

  return (
    <>
      <Slot />
      <StatusBar style="light" />
    </>
  );
}
