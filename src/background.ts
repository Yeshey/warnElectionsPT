import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { scrapeElections, computeNotifications } from './elections';
import { sendNotification, clearScheduledNotifications } from './notifications';

export const TASK_NAME = 'election-check';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const elections = await scrapeElections(8);
    
    // Clear old scheduled notes
    await clearScheduledNotifications();

    // Silently pre-schedule for the next 7 days at 10 AM
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + i);
      targetDate.setHours(10, 0, 0, 0);

      if (targetDate.getTime() < Date.now()) continue;

      const notes = computeNotifications(elections, targetDate);

      // Só agenda notificações se existirem eleições próximas (ou se for o resumo mensal do dia 1)
      for (const n of notes) {
        await sendNotification(n.title, n.body, targetDate);
      }
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundTask() {
  const status = await BackgroundTask.getStatusAsync();

  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
    console.warn('[background] Background tasks restricted by system, cannot register.');
    return;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) {
    console.log('[background] Task already registered.');
    return;
  }

  // expo-background-task API only expects minimumInterval
  await BackgroundTask.registerTaskAsync(TASK_NAME, {
    minimumInterval: 60 * 60 * 12, // 12 hours
  });

  console.log('[background] Task registered successfully.');
}