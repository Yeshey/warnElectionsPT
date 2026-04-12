/**
 * foreground.ts
 *
 * A true Android Foreground Service using react-native-background-actions.
 *
 * WHY THIS IS MORE RELIABLE THAN BackgroundFetch / WorkManager:
 *  - WorkManager (expo-background-fetch) can be deferred indefinitely by Doze,
 *    App Standby, or aggressive OEM battery management (Samsung, Xiaomi, etc.).
 *  - A Foreground Service is protected by Android OS contract: it CANNOT be
 *    silently killed while its notification is showing.  The user CAN stop it
 *    from the notification shade, but the OS cannot.
 *
 * INSTALL (run these once, then rebuild):
 *   npm install react-native-background-actions
 *   npx expo prebuild --clean          # re-generates android/ with plugin changes
 *   npx expo run:android               # (or eas build -p android)
 */

import BackgroundService from 'react-native-background-actions';
import { scrapeElections, computeNotifications } from './elections';
import { sendNotification } from './notifications';

// ─── Timing ─────────────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8 hours between checks

// ─── Task ────────────────────────────────────────────────────────────────────

const electionCheckLoop = async (_taskData: unknown): Promise<void> => {
  // The loop runs forever; BackgroundService.isRunning() becomes false only when
  // the user explicitly stops the service from the notification shade.
  while (BackgroundService.isRunning()) {
    await runCheck();

    // Wait for the next interval, but bail early if service was stopped.
    await sleepInterruptible(CHECK_INTERVAL_MS);
  }
};

async function runCheck(): Promise<void> {
  try {
    // 8 proxy rounds ≈ up to 1 hour of retries on a bad connection
    const elections = await scrapeElections(8);
    const notes = computeNotifications(elections);

    for (const n of notes) {
      await sendNotification(n.title, n.body);
    }

    // Always notify so you can confirm the service is alive.
    // Remove this block once you're confident everything works.
    const DEBUG = true;
    if (DEBUG && notes.length === 0) {
      const now = new Date().toLocaleTimeString('pt-PT');
      await sendNotification(
        '✅ Verificação Periódica',
        `Nenhuma eleição próxima detectada. (${now})`,
      );
    }
  } catch (e) {
    await sendNotification(
      '❌ Verificação Falhou',
      'Não foi possível obter o calendário eleitoral após várias tentativas. Verifica a tua ligação.',
    );
  }
}

/**
 * Sleeps for `ms` milliseconds, but resolves early (after a short tick) if the
 * background service has been stopped — avoids a zombie promise keeping JS alive.
 */
async function sleepInterruptible(ms: number): Promise<void> {
  const TICK = 5_000; // check every 5 s whether service is still running
  let elapsed = 0;
  while (elapsed < ms && BackgroundService.isRunning()) {
    const step = Math.min(TICK, ms - elapsed);
    await new Promise<void>((res) => setTimeout(res, step));
    elapsed += step;
  }
}

// ─── Options ─────────────────────────────────────────────────────────────────

const SERVICE_OPTIONS = {
  taskName: 'ElectionMonitor',
  taskTitle: '🗳️ Alerta Eleitoral Ativo',
  taskDesc:  'A monitorizar o calendário eleitoral português',
  taskIcon:  { name: 'ic_launcher', type: 'mipmap' },
  color:     '#1a73e8',
  // linkingURI: 'warnelections://app',   // uncomment after adding deep-link scheme
  parameters: {},
};

// ─── Public API ──────────────────────────────────────────────────────────────

/** Starts the foreground service (and runs the first check immediately). */
export async function startForegroundService(): Promise<void> {
  if (BackgroundService.isRunning()) return;
  await BackgroundService.start(electionCheckLoop, SERVICE_OPTIONS);
}

/** Stops the foreground service and removes the persistent notification. */
export async function stopForegroundService(): Promise<void> {
  await BackgroundService.stop();
}

export function isForegroundServiceRunning(): boolean {
  return BackgroundService.isRunning();
}