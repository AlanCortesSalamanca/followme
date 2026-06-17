import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { createTrip } from '@/services/supabase/trips';

export default function CreateTripScreen() {
  const { session } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!session?.user.id) return;
    if (title.trim().length < 3) {
      setError('El titulo debe tener al menos 3 caracteres.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const trip = await createTrip(session.user.id, title.trim(), description.trim());
      router.replace(`/(tabs)/trips/${trip.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear viaje');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <Text style={styles.title}>Crear viaje</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Titulo del viaje"
          placeholderTextColor="#64748B"
          value={title}
          onChangeText={(t) => { setTitle(t); setError(null); }}
          autoFocus
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Descripcion (opcional)"
          placeholderTextColor="#64748B"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <Pressable
          style={[styles.button, (isCreating || !title.trim()) && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={isCreating || !title.trim()}
        >
          {isCreating ? (
            <ActivityIndicator color="#082F49" />
          ) : (
            <Text style={styles.buttonText}>Crear viaje</Text>
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
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
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
