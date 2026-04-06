import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  // On Android, prompt the user to disable battery optimisation for the app.
  // Without this, even AlarmManager-based triggers can be deferred/killed.
  if (Platform.OS === 'android') {
    await promptDisableBatteryOptimization();
  }

  return true;
}

async function promptDisableBatteryOptimization() {
  Alert.alert(
    'Optimização de Bateria',
    'Para garantir notificações diárias fiáveis, por favor desativa a optimização de bateria para esta aplicação.',
    [
      { text: 'Agora Não', style: 'cancel' },
      {
        text: 'Abrir Definições',
        onPress: () => {
          const pkg = Constants.expoConfig?.android?.package ?? Constants.manifest?.android?.package;
          if (pkg) {
            // Opens the specific battery optimization screen for this app
            IntentLauncher.startActivityAsync(
              IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
              { data: `package:${pkg}` },
            ).catch(() => {
              // Fallback: open generic battery settings
              IntentLauncher.startActivityAsync(
                IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
              );
            });
          }
        },
      },
    ],
  );
}

export async function sendNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // immediate
  });
}

const DAILY_CHECK_ID = 'daily-election-check';

/**
 * Schedules (or re-schedules) a silent daily "wake-up" notification at 14:00.
 * The app's notification response listener in App.tsx handles the actual scrape
 * when this fires. We also keep it as a visible notification so you KNOW it ran.
 *
 * Call this once on startup. It's idempotent — cancels any existing one first.
 */
export async function scheduleDailyCheck(hour = 14, minute = 0) {
  // Cancel previous schedule to avoid duplicates across app restarts
  await Notifications.cancelScheduledNotificationAsync(DAILY_CHECK_ID).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_CHECK_ID,
    content: {
      title: '🗳️ A verificar eleições…',
      body: 'Verificação diária em curso.',
      data: { type: 'daily-check' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelDailyCheck() {
  await Notifications.cancelScheduledNotificationAsync(DAILY_CHECK_ID).catch(() => {});
}