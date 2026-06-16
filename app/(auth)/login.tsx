import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Follow Me</Text>
      <Text style={styles.subtitle}>Viaja en grupo sin perder a nadie.</Text>
      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Iniciar sesion</Text>
      </Pressable>
      <Link href="/(auth)/register" style={styles.link}>
        Crear cuenta
      </Link>
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
    fontSize: 36,
    fontWeight: '800',
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 14,
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
