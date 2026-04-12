/**
 * plugins/withBackgroundActions.js
 *
 * Custom Expo config plugin for react-native-background-actions.
 * The library has no app.plugin.js of its own, so we add the required
 * AndroidManifest.xml entries manually here.
 *
 * What this does:
 *  1. Adds the FOREGROUND_SERVICE + FOREGROUND_SERVICE_DATA_SYNC permissions
 *  2. Declares the RNBackgroundActionsTask service with foregroundServiceType
 *
 * Usage in app.json:
 *   "plugins": ["./plugins/withBackgroundActions"]
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const withBackgroundActions = (config, { foregroundServiceType = 'dataSync' } = {}) => {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults;
    const app = manifest.manifest.application[0];

    // ── 1. Permissions ──────────────────────────────────────────────────────
    //    (expo adds them via app.json "permissions" too, but belt-and-suspenders)
    const permissions = manifest.manifest['uses-permission'] ?? [];

    const needed = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
    ];

    for (const perm of needed) {
      const already = permissions.some(
        (p) => p.$?.['android:name'] === perm,
      );
      if (!already) {
        permissions.push({ $: { 'android:name': perm } });
      }
    }

    manifest.manifest['uses-permission'] = permissions;

    // ── 2. Service declaration ───────────────────────────────────────────────
    const services = app.service ?? [];

    const serviceName =
      'com.asterinet.reaction.bgTask.RNBackgroundActionsTask';
    const alreadyDeclared = services.some(
      (s) => s.$?.['android:name'] === serviceName,
    );

    if (!alreadyDeclared) {
      services.push({
        $: {
          'android:name': serviceName,
          'android:foregroundServiceType': foregroundServiceType,
        },
      });
    }

    app.service = services;
    return androidConfig;
  });
};

module.exports = withBackgroundActions;