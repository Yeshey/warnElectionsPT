/**
 * background.ts
 *
 * WorkManager-based background fetch — kept as a belt-and-suspenders fallback
 * alongside the foreground service in foreground.ts.
 *
 * Reliability tiers (best → worst):
 *   1. Foreground service (foreground.ts)  — guaranteed, persistent notification
 *   2. WorkManager + battery exemption     — good on stock Android, variable on OEMs
 *   3. WorkManager alone                   — unreliable on Samsung/Xiaomi/etc.
 *
 * The foreground service handles the actual checks.
 * This task fires as a bonus safety-net in case the service was ever stopped.
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { scrapeElections, computeNotifications } from './elections';
import { sendNotification } from './notifications';

export const TASK_NAME = 'election-check';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const elections = await scrapeElections(8);
    const notes = computeNotifications(elections);

    for (const n of notes) {
      await sendNotification(n.title, n.body);
    }

    const DEBUG = true;
    if (DEBUG && notes.length === 0) {
      await sendNotification(
        '✅ Background Check (WorkManager)',
        'Sem eleições próximas. (tarefa BackgroundFetch)',
      );
    }

    return notes.length > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    try {
      await sendNotification(
        '❌ Verificação Falhou',
        'Não foi possível obter o calendário eleitoral após várias tentativas.',
      );
    } catch {
      // Nothing more we can do
    }
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundTask(): Promise<void> {
  const status = await BackgroundFetch.getStatusAsync();
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    status === BackgroundFetch.BackgroundFetchStatus.Denied
  ) {
    return;
  }

  try {
    await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
  } catch {
    // Task wasn't registered yet — fine
  }

  await BackgroundFetch.registerTaskAsync(TASK_NAME, {
    minimumInterval: 60 * 60 * 8, // 8 hours minimum
    stopOnTerminate: false,        // Android: keep running after app is swiped away
    startOnBoot: true,             // Android: restart after device reboot
  });
}