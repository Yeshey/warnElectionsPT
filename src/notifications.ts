import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ─── Channel IDs ────────────────────────────────────────────────────────────

export const CHANNEL_ALERTS   = 'election-alerts';
export const CHANNEL_SERVICE  = 'election-service';   // for the persistent service notification

// ─── Notification handler ────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Setup ──────────────────────────────────────────────────────────────────

/**
 * Creates the Android notification channels and requests permissions.
 * Call this once, early in App.tsx (e.g. inside a useEffect on mount).
 */
export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // High-importance channel for election alerts
    await Notifications.setNotificationChannelAsync(CHANNEL_ALERTS, {
      name: 'Alertas de Eleições',
      description: 'Notificações sobre eleições próximas',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1a73e8',
      sound: 'default',
      showBadge: true,
    });

    // Low-importance channel for the persistent "service running" notification
    await Notifications.setNotificationChannelAsync(CHANNEL_SERVICE, {
      name: 'Serviço de Eleições',
      description: 'Indica que o monitoramento está ativo',
      importance: Notifications.AndroidImportance.LOW,   // silent, no sound
      showBadge: false,
    });
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Send ────────────────────────────────────────────────────────────────────

/** Sends an immediate notification on the high-importance alerts channel. */
export async function sendNotification(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ALERTS } : {}),
    },
    trigger: null, // immediate
  });
}

/** Legacy alias kept so background.ts imports still compile without changes. */
export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}