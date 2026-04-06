import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { requestPermissions, sendNotification, scheduleDailyCheck } from './src/notifications';
import { scrapeElections, computeNotifications } from './src/elections';

const CNE_URL = 'https://www.cne.pt/content/calendario';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const listenerRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    (async () => {
      const granted = await requestPermissions();
      if (granted) {
        await scheduleDailyCheck(14, 0); // every day at 14:00
      }
    })();

    // This listener fires when a scheduled notification is received while the
    // app is in the foreground OR background (on Android, the OS can wake the
    // app briefly). We use it to trigger the actual election scrape.
    listenerRef.current = Notifications.addNotificationReceivedListener(async (notification) => {
      if (notification.request.content.data?.type === 'daily-check') {
        await runCheck(/* silent = */ false);
      }
    });

    return () => {
      listenerRef.current?.remove();
    };
  }, []);

  async function runCheck(triggeredByButton = true) {
    if (loading) return;
    setLoading(true);
    try {
      const elections = await scrapeElections(triggeredByButton ? 1 : 8);
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

      const now = new Date().toLocaleString('pt-PT');
      setLastCheck(now);
    } catch (e) {
      await sendNotification(
        'Verificação Falhou',
        'Não foi possível obter o calendário eleitoral. Verifica a tua ligação.',
      );
      if (triggeredByButton) {
        Alert.alert('Erro', 'Não foi possível verificar as eleições. Tenta novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🗳️ Eleições PT</Text>
      <Text style={styles.subtitle}>
        Verifica o calendário eleitoral diariamente às 14h e notifica-te sobre eleições próximas.
      </Text>

      <TouchableOpacity style={styles.button} onPress={() => runCheck(true)} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'A verificar…' : 'Verificar Agora'}</Text>
      </TouchableOpacity>

      {lastCheck && (
        <Text style={styles.lastCheck}>Última verificação: {lastCheck}</Text>
      )}

      <TouchableOpacity onPress={() => Linking.openURL(CNE_URL)}>
        <Text style={styles.link}>{CNE_URL}</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        Notificação diária agendada para as 14:00.{'\n'}
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