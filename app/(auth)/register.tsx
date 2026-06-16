import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>
      <Text style={styles.subtitle}>El formulario de registro se implementara en la fase de Auth.</Text>
      <Link href="/(auth)/login" style={styles.link}>
        Volver a login
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
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#CBD5E1',
    marginTop: 12,
  },
  link: {
    color: '#7DD3FC',
    marginTop: 24,
  },
});
