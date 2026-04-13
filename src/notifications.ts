import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function sendNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // immediate
  });
}

const DAILY_CHECK_ID = 'daily-election-check-heartbeat';

/**
 * Schedule a silent daily notification at 09:00 that acts as proof-of-life.
 * The background task does the real work; this ensures something fires daily
 * even if the OS never wakes the background task.
 *
 * On Android, DAILY triggers use AlarmManager and survive app termination.
 */
export async function scheduleDailyHeartbeat() {
  // Cancel existing so we don't double-schedule
  await Notifications.cancelScheduledNotificationAsync(DAILY_CHECK_ID).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_CHECK_ID,
    content: {
      title: '🗳️ Warn Elections',
      body: 'A verificar calendário eleitoral…',
      // Make it low-priority so it's not intrusive
      priority: Notifications.AndroidNotificationPriority.LOW,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });
}

export async function cancelDailyHeartbeat() {
  await Notifications.cancelScheduledNotificationAsync(DAILY_CHECK_ID).catch(() => {});
}