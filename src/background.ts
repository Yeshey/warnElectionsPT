import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { scrapeElections, computeNotifications } from './elections';
import { sendNotification } from './notifications';

export const TASK_NAME = 'election-check';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const hour = new Date().getHours();
    if (hour < 13 || hour > 15) return BackgroundFetch.BackgroundFetchResult.NoData;

    const elections = await scrapeElections();
    const notes = computeNotifications(elections);
    for (const n of notes) await sendNotification(n.title, n.body);

    if (notes.length === 0) {
      // DEBUG: remove this block once you've confirmed background tasks are firing
      await sendNotification('✅ Verificação Diária', 'Nenhuma eleição próxima encontrada.');
      // END DEBUG
    }

    return notes.length > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundTask() {
  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Restricted || status === BackgroundFetch.BackgroundFetchStatus.Denied) return;

  await BackgroundFetch.registerTaskAsync(TASK_NAME, {
    minimumInterval: 60 * 60 * 8, // every 8 hours (OS decides exact timing)
    stopOnTerminate: false,
    startOnBoot: true,
  });
}