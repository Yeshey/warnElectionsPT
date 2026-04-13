import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, Platform } from 'react-native';
import { requestPermissions, sendNotification } from './src/notifications';
import { registerBackgroundTask } from './src/background';
import { scrapeElections, computeNotifications } from './src/elections';

const CNE_URL = 'https://www.cne.pt/content/calendario';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const granted = await requestPermissions();
      if (granted) {
        await registerBackgroundTask();
      }
    })();
  }, []);

  async function runCheck() {
    if (loading) return;
    setLoading(true);
    try {
      // maxRounds=1: try each proxy once, fail fast — this is a manual button press
      const elections = await scrapeElections(1);
      const notes = computeNotifications(elections);

      if (notes.length === 0) {
        await sendNotification(
          'Sem Eleições Próximas',
          `Verificação concluída às ${new Date().toLocaleTimeString('pt-PT')}. Nenhuma eleição próxima.`,
        );
      } else {
        for (const n of notes) {
          await sendNotification(n.title, n.body);
        }
      }

      setLastCheck(new Date().toLocaleString('pt-PT'));
    } catch {
      Alert.alert('Erro', 'Não foi possível verificar as eleições. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🗳️ Eleições PT</Text>
      <Text style={styles.subtitle}>
        Verifica o calendário eleitoral automaticamente e notifica-te sobre eleições próximas.
      </Text>

      <TouchableOpacity style={styles.button} onPress={runCheck} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'A verificar…' : 'Verificar Agora'}</Text>
      </TouchableOpacity>

      {lastCheck && (
        <Text style={styles.lastCheck}>Última verificação: {lastCheck}</Text>
      )}

      <TouchableOpacity onPress={() => Linking.openURL(CNE_URL)}>
        <Text style={styles.link}>{CNE_URL}</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        Verificação automática em segundo plano a cada 8 horas.{'\n'}
        {Platform.OS === 'android'
          ? 'Certifica-te de que a optimização de bateria está desativada.'
          : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 24, backgroundColor: '#fff',
  },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  subtitle: {
    fontSize: 13, color: '#555', textAlign: 'center',
    marginBottom: 32, paddingHorizontal: 16,
  },
  button: {
    backgroundColor: '#003399', paddingHorizontal: 32,
    paddingVertical: 16, borderRadius: 12, marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  lastCheck: { fontSize: 12, color: '#888', marginBottom: 24 },
  link: {
    color: '#003399', textDecorationLine: 'underline',
    fontSize: 13, textAlign: 'center', marginBottom: 16,
  },
  footer: {
    fontSize: 11, color: '#aaa', textAlign: 'center',
    position: 'absolute', bottom: 32, paddingHorizontal: 24,
  },
});