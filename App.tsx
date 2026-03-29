import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { requestPermissions, sendNotification } from './src/notifications';
import { scrapeElections, computeNotifications } from './src/elections';
import { registerBackgroundTask } from './src/background';

const CNE_URL = 'https://www.cne.pt/content/calendario';

export default function App() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requestPermissions();
    registerBackgroundTask();
  }, []);

  async function handleCheck() {
    setLoading(true);
    try {
      const elections = await scrapeElections();
      const notes = computeNotifications(elections);
      if (notes.length === 0) {
        await sendNotification('Sem Eleições Próximas', 'Nenhuma eleição próxima encontrada.');
      } else {
        for (const n of notes) await sendNotification(n.title, n.body);
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível verificar as eleições. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🗳️ Eleições PT</Text>
      <Text style={styles.subtitle}>
        Verifica eleições diariamente entre as 13h–15h e envia uma notificação se encontrar eleições próximas.
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleCheck} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'A verificar...' : 'Check Elections'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL(CNE_URL)}>
        <Text style={styles.link}>{CNE_URL}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 40 },
  button: { backgroundColor: '#003399', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, marginBottom: 32 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  link: { color: '#003399', textDecorationLine: 'underline', fontSize: 13, textAlign: 'center' },
  subtitle: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
});