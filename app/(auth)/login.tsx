import { useState } from 'react';
import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    await signIn(email.trim(), password);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <Text style={styles.title}>Follow Me</Text>
        <Text style={styles.subtitle}>Viaja en grupo sin perder a nadie.</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Correo electronico"
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={(t) => { setEmail(t); clearError(); }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Contrasena"
          placeholderTextColor="#64748B"
          value={password}
          onChangeText={(t) => { setPassword(t); clearError(); }}
          secureTextEntry
          autoComplete="password"
        />

        <Pressable
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#082F49" />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesion</Text>
          )}
        </Pressable>

        <Link href="/(auth)/register" style={styles.link}>
          Crear cuenta
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
    fontSize: 36,
    fontWeight: '800',
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 32,
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
