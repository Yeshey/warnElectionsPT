import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { scrapeElections, computeNotifications } from './elections';
import { sendNotification } from './notifications';

export const TASK_NAME = 'election-check';

// Must be called at module load time (top level), not inside a component.
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    // 8 rounds ≈ up to ~1 hour of retrying with exponential backoff.
    // Network is guaranteed available — expo-background-task requires it.
    const elections = await scrapeElections(8);
    const notes = computeNotifications(elections);

    for (const n of notes) {
      await sendNotification(n.title, n.body);
    }

    // DEBUG: remove once you've confirmed background tasks fire correctly
    const DEBUG = true;
    if (DEBUG && notes.length === 0) {
      await sendNotification(
        '✅ Verificação Diária',
        `Nenhuma eleição próxima. (${new Date().toLocaleTimeString('pt-PT')})`,
      );
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    try {
      await sendNotification(
        '❌ Verificação Falhou',
        'Não foi possível obter o calendário eleitoral após várias tentativas.',
      );
    } catch {}
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundTask() {
  const status = await BackgroundTask.getStatusAsync();

  // Only Restricted means truly unavailable (parental controls, etc.)
  // Available is the normal state on both Android and iOS
  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
    console.warn('[background] Background tasks restricted by system, cannot register.');
    return;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) {
    console.log('[background] Task already registered.');
    return;
  }

  await BackgroundTask.registerTaskAsync(TASK_NAME, {
    minimumInterval: 60 * 60 * 24, // 24 hours — OS decides exact time
  });

  console.log('[background] Task registered successfully.');
}