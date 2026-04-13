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
    'Optimização de Bateria',
    'Para garantir notificações diárias fiáveis, por favor desativa a optimização de bateria para esta aplicação.',
    [
      { text: 'Agora Não', style: 'cancel' },
      {
        text: 'Abrir Definições',
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

export async function sendNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // immediate
  });
}