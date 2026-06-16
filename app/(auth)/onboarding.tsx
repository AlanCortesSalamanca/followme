import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { updateProfile } from '@/services/supabase/auth';

export default function OnboardingScreen() {
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    if (displayName.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }

    const { session, profile } = useAuthStore.getState();
    if (!session?.user.id) return;

    setIsSaving(true);
    setError(null);

    try {
      await updateProfile(session.user.id, {
        display_name: displayName.trim(),
        is_onboarded: true,
      });

      const { initialize } = useAuthStore.getState();
      await initialize(session);

      router.replace('/(tabs)/trips');
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tu grupo en el mapa</Text>
      <Text style={styles.subtitle}>
        Follow Me comparte tu ubicacion solo durante viajes activos.
        Pon un nombre para que tus amigos te reconozcan.
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Tu nombre visible"
        placeholderTextColor="#64748B"
        value={displayName}
        onChangeText={(t) => { setDisplayName(t); setError(null); }}
        autoCapitalize="words"
        autoFocus
      />

      <Pressable
        style={[styles.button, (isSaving || !displayName.trim()) && styles.buttonDisabled]}
        onPress={handleComplete}
        disabled={isSaving || !displayName.trim()}
      >
        {isSaving ? (
          <ActivityIndicator color="#082F49" />
        ) : (
          <Text style={styles.buttonText}>Comenzar</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0F172A',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FECACA',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F8FAFC',
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#082F49',
    fontSize: 16,
    fontWeight: '700',
  },
});
