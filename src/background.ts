import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { scrapeElections, computeNotifications } from './elections';
import { sendNotification } from './notifications';

export const TASK_NAME = 'election-check';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const elections = await scrapeElections();
    const notes = computeNotifications(elections);

    for (const n of notes) {
      await sendNotification(n.title, n.body);
    }

    // DEBUG: always notify so we can confirm background tasks are firing.
    // Remove (or set DEBUG = false) once confirmed.
    const DEBUG = true;
    if (DEBUG && notes.length === 0) {
      await sendNotification(
        '✅ Verificação Diária',
        'Nenhuma eleição próxima encontrada.',
      );
    }

    return notes.length > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (e) {
    // scrapeElections already retried for up to 1 hour before throwing.
    // Send a failure notification so we know the task ran but couldn't fetch.
    try {
      await sendNotification(
        '❌ Verificação Falhou',
        'Não foi possível obter o calendário eleitoral após várias tentativas. Verifica a tua ligação à internet.',
      );
    } catch {
      // If even this fails, nothing more we can do.
    }
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundTask() {
  const status = await BackgroundFetch.getStatusAsync();
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    status === BackgroundFetch.BackgroundFetchStatus.Denied
  ) {
    return;
  }

  // Unregister first to avoid duplicate task registration across app restarts
  try {
    await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
  } catch {
    // Task wasn't registered yet — that's fine
  }

  await BackgroundFetch.registerTaskAsync(TASK_NAME, {
    minimumInterval: 60 * 60 * 8, // every 8 hours minimum (OS decides exact timing)
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
