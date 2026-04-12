/**
 * setup.ts
 *
 * One-time setup prompts that dramatically improve background task reliability:
 *
 *  1. Battery-optimization exemption  — removes the app from Doze restrictions
 *  2. Exact-alarm permission          — lets WorkManager fire at precise times
 *
 * Call setupAndroidReliability() once when the user first opens the app, or
 * expose a "Fix Background" button in settings so they can revisit it.
 *
 * INSTALL:
 *   npx expo install expo-intent-launcher
 */

import { Platform, Alert } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

const PACKAGE = 'com.yeshey.warnElectionsPT';

// ─── Battery optimisation ────────────────────────────────────────────────────

/**
 * Asks the user to whitelist this app from battery optimisation.
 * This is the single most impactful thing you can do for WorkManager reliability
 * on OEM Android (Samsung, Xiaomi, OnePlus, etc.).
 *
 * Uses ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS which shows a direct OS
 * dialog ("Allow app to run in background?") — no settings navigation needed.
 */
export async function requestBatteryOptimizationExemption(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // Direct per-app dialog (Android 6+)
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS' as any,
      { data: `package:${PACKAGE}` },
    );
  } catch {
    try {
      // Fallback: open the general "Battery optimisation" list
      await IntentLauncher.startActivityAsync(
        'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS' as any,
      );
    } catch {
      // Device doesn't support this intent — nothing more we can do
    }
  }
}

// ─── Exact alarm ─────────────────────────────────────────────────────────────

/**
 * On Android 12+ (API 31+), apps must hold SCHEDULE_EXACT_ALARM to fire
 * WorkManager tasks at precise times. Without it, alarms can be deferred.
 */
export async function requestExactAlarmPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_SCHEDULE_EXACT_ALARM' as any,
      { data: `package:${PACKAGE}` },
    );
  } catch {
    // Already granted, or not available on this API level — fine to ignore
  }
}

// ─── Combined flow ───────────────────────────────────────────────────────────

/**
 * Show a single alert explaining why we need these permissions, then
 * guide the user through both dialogs in sequence.
 *
 * Suggested call site: inside App.tsx useEffect, guarded by AsyncStorage
 * so it only runs once (e.g. key 'setup_done').
 *
 * Example:
 *   const done = await AsyncStorage.getItem('setup_done');
 *   if (!done) {
 *     await setupAndroidReliability();
 *     await AsyncStorage.setItem('setup_done', '1');
 *   }
 */
export async function setupAndroidReliability(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await new Promise<void>((resolve) =>
    Alert.alert(
      '🗳️ Monitorização de Eleições',
      'Para funcionar em segundo plano, a app precisa de:\n\n' +
        '1. Ser excluída da otimização de bateria\n' +
        '2. Poder usar alarmes exatos\n\n' +
        'Irão aparecer dois diálogos — confirma ambos.',
      [{ text: 'OK', onPress: resolve }],
    ),
  );

  await requestBatteryOptimizationExemption();
  await requestExactAlarmPermission();
}