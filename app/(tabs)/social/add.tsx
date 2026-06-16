import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { searchUsers, sendFriendRequest, UserSearchResult } from '@/services/supabase/friends';

export default function AddFriendScreen() {
  const { session } = useAuthStore();
  const userId = session?.user.id;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    setError(null);
    if (!userId || text.trim().length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const data = await searchUsers(text, userId);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [userId]);

  const handleSend = async (receiverId: string) => {
    setSendingTo(receiverId);
    setError(null);
    try {
      await sendFriendRequest(userId!, receiverId);
      setResults((prev) => prev.filter((u) => u.id !== receiverId));
    } catch (e: any) {
      setError(e.message ?? 'Error al enviar solicitud');
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Buscar por nombre o correo..."
        placeholderTextColor="#64748B"
        value={query}
        onChangeText={handleSearch}
        autoCapitalize="none"
        autoFocus
      />

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isSearching ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38BDF8" />
        </View>
      ) : results.length === 0 && query.trim().length >= 2 ? (
        <View style={styles.center}>
          <Text style={styles.noResults}>No se encontraron usuarios</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.display_name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.name}>{item.display_name}</Text>
              <Pressable
                style={[styles.addButton, sendingTo === item.id && styles.addButtonDisabled]}
                onPress={() => handleSend(item.id)}
                disabled={sendingTo === item.id}
              >
                {sendingTo === item.id ? (
                  <ActivityIndicator size="small" color="#082F49" />
                ) : (
                  <Text style={styles.addButtonText}>Agregar</Text>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F8FAFC',
    fontSize: 16,
    margin: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  errorText: {
    color: '#FECACA',
    fontSize: 14,
  },
  noResults: {
    color: '#64748B',
    fontSize: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  name: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  addButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#082F49',
    fontWeight: '700',
    fontSize: 13,
  },
});
