import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { joinTripByCode, normalizeInviteCode } from '@/services/supabase/trips';

export default function JoinTripScreen() {
  const { session } = useAuthStore();
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!session?.user.id) return;
    const cleanCode = normalizeInviteCode(code);
    if (cleanCode.length < 8) {
      setError('El codigo debe tener 8 caracteres.');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const trip = await joinTripByCode(cleanCode, session.user.id);
      router.replace(`/(tabs)/trips/${trip.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al unirse al viaje');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <Text style={styles.title}>Unirse a viaje</Text>
        <Text style={styles.subtitle}>Ingresa el codigo de invitacion de 8 caracteres.</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Codigo de 8 caracteres"
          placeholderTextColor="#64748B"
          value={code}
          onChangeText={(t) => { setCode(t.toUpperCase()); setError(null); }}
          autoCapitalize="characters"
          maxLength={8}
          autoFocus
        />

        <Pressable
          style={[styles.button, (isJoining || code.trim().length < 8) && styles.buttonDisabled]}
          onPress={handleJoin}
          disabled={isJoining || code.trim().length < 8}
        >
          {isJoining ? (
            <ActivityIndicator color="#082F49" />
          ) : (
            <Text style={styles.buttonText}>Unirse</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  inner: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 15,
    marginTop: 8,
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
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
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
