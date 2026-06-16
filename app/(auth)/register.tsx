import { useState } from 'react';
import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { signUp, isLoading, error, clearError } = useAuthStore();

  const handleRegister = async () => {
    setLocalError(null);
    clearError();

    if (!email.trim() || !password || !confirmPassword || !displayName.trim()) {
      setLocalError('Todos los campos son obligatorios.');
      return;
    }
    if (displayName.trim().length < 2) {
      setLocalError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (password.length < 6) {
      setLocalError('La contrasena debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Las contrasenas no coinciden.');
      return;
    }

    await signUp(email.trim(), password, displayName.trim());
    const currentError = useAuthStore.getState().error;
    if (!currentError) {
      router.replace('/(auth)/login');
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>Unete a Follow Me y viaja en grupo.</Text>

        {displayError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Nombre visible"
          placeholderTextColor="#64748B"
          value={displayName}
          onChangeText={(t) => { setDisplayName(t); setLocalError(null); clearError(); }}
          autoCapitalize="words"
        />

        <TextInput
          style={styles.input}
          placeholder="Correo electronico"
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={(t) => { setEmail(t); setLocalError(null); clearError(); }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Contrasena (min. 6 caracteres)"
          placeholderTextColor="#64748B"
          value={password}
          onChangeText={(t) => { setPassword(t); setLocalError(null); clearError(); }}
          secureTextEntry
          autoComplete="new-password"
        />

        <TextInput
          style={styles.input}
          placeholder="Confirmar contrasena"
          placeholderTextColor="#64748B"
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); setLocalError(null); clearError(); }}
          secureTextEntry
          autoComplete="new-password"
        />

        <Pressable
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#082F49" />
          ) : (
            <Text style={styles.buttonText}>Crear cuenta</Text>
          )}
        </Pressable>

        <Link href="/(auth)/login" style={styles.link}>
          Volver a inicio de sesion
        </Link>
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
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#CBD5E1',
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
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#082F49',
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    color: '#7DD3FC',
    marginTop: 18,
    textAlign: 'center',
  },
});
