import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { scrapeElections, computeNotifications } from './elections';
import { sendNotification } from './notifications';

export const TASK_NAME = 'election-check';

// Must be defined at global scope
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const elections = await scrapeElections(8);
    const notes = computeNotifications(elections);

    for (const n of notes) {
      await sendNotification(n.title, n.body);
    }

    if (notes.length === 0) {
      await sendNotification(
        '✅ Verificação Diária',
        'Nenhuma eleição próxima encontrada.',
      );
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    try {
      await sendNotification(
        '❌ Verificação Falhou',
        'Não foi possível obter o calendário eleitoral. Verifica a ligação à internet.',
      );
    } catch {}
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundTask() {
  // Check if already registered to avoid duplicate registration
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) return;

  await BackgroundTask.registerTaskAsync(TASK_NAME, {
    minimumInterval: 60 * 60 * 8, // 8 hours minimum; OS decides exact time
  });
}