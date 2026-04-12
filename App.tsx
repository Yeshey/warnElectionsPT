/**
 * App.tsx — wiring example
 *
 * Shows how to connect all the pieces on first launch.
 * Adapt to your actual UI as needed.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, AsyncStorage,
} from 'react-native';

import { setupNotifications }          from './src/notifications';
import { setupAndroidReliability }     from './src/setup';
import { registerBackgroundTask }      from './src/background';
import {
  startForegroundService,
  stopForegroundService,
  isForegroundServiceRunning,
}                                      from './src/foreground';

const SETUP_KEY = 'setup_v1_done';

export default function App() {
  const [serviceRunning, setServiceRunning] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    // 1. Create notification channels + request notification permission
    await setupNotifications();

    // 2. One-time battery/alarm exemption prompts
    const done = await AsyncStorage.getItem(SETUP_KEY).catch(() => null);
    if (!done) {
      await setupAndroidReliability();
      await AsyncStorage.setItem(SETUP_KEY, '1').catch(() => null);
    }

    // 3. Register WorkManager fallback task
    await registerBackgroundTask();

    // 4. Start the foreground service (the sure-fire layer)
    await startForegroundService();
    setServiceRunning(isForegroundServiceRunning());
  }

  async function toggleService() {
    if (isForegroundServiceRunning()) {
      await stopForegroundService();
    } else {
      await startForegroundService();
    }
    setServiceRunning(isForegroundServiceRunning());
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🗳️ Alerta Eleitoral PT</Text>

      <View style={[styles.badge, serviceRunning ? styles.on : styles.off]}>
        <Text style={styles.badgeText}>
          {serviceRunning ? '● Serviço ativo' : '○ Serviço parado'}
        </Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={toggleService}>
        <Text style={styles.btnText}>
          {serviceRunning ? 'Parar serviço' : 'Iniciar serviço'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        O serviço verifica o calendário eleitoral a cada 8 horas{'\n'}
        e envia uma notificação com o resultado.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title:     { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  badge:     { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 20 },
  on:        { backgroundColor: '#d4edda' },
  off:       { backgroundColor: '#f8d7da' },
  badgeText: { fontSize: 14, fontWeight: '600' },
  btn:       { backgroundColor: '#1a73e8', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 14, marginBottom: 20 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '600' },
  hint:      { color: '#666', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});