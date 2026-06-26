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

  if (Platform.OS === 'android') {
    await promptDisableBatteryOptimization();
  }

  return true;
}

async function promptDisableBatteryOptimization() {
  Alert.alert(
    'Reliable Notifications',
    'To make sure you receive election alerts (and the monthly verification), disable these 2 Android settings:\n\n' +
      '1) Battery → Set this app to "Unrestricted"\n' +
      '2) App info → Turn off "Pause app activity if unused"\n\n' +
      'On Xiaomi/Huawei/Oppo devices, also enable auto-start in the security settings.',
    [
      { text: 'Not Now', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          const pkg =
            Constants.expoConfig?.android?.package ??
            (Constants.manifest as any)?.android?.package;

          if (pkg) {
            IntentLauncher.startActivityAsync(
              IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
              { data: `package:${pkg}` },
            ).catch(() => {
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

export async function clearScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function sendNotification(title: string, body: string, triggerDate?: Date) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: triggerDate
      ? {
          type: Notifications.SchedulableTriggerInputTypes.DATE, // <--- FIXED TS ERROR
          date: triggerDate,
        }
      : null, // immediate if no date provided
  });
}