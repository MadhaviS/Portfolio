const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
  createRunOncePlugin,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE = 'withAndroidFocusTimer';
const SERVICE = 'com.stickynotification.StickyNotificationService';

const VECTOR_ICON = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
  <path
      android:fillColor="#FFFFFF"
      android:pathData="M12,2C6.5,2 2,6.5 2,12s4.5,10 10,10 10,-4.5 10,-10S17.5,2 12,2zM12.5,7h-1.5v6l5.2,3.1 0.8,-1.2 -4.5,-2.7V7z"/>
</vector>
`;

function ensurePermission(androidManifest, name) {
  const perms = androidManifest.manifest['uses-permission'] ?? [];
  if (!perms.some((p) => p.$?.['android:name'] === name)) {
    perms.push({ $: { 'android:name': name } });
    androidManifest.manifest['uses-permission'] = perms;
  }
}

function ensureServiceType(androidManifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  if (!app.service) app.service = [];

  let service = app.service.find((s) => s.$?.['android:name'] === SERVICE);
  if (!service) {
    service = {
      $: {
        'android:name': SERVICE,
        'android:exported': 'false',
        'android:foregroundServiceType': 'specialUse',
        'tools:replace': 'android:foregroundServiceType',
      },
      property: [
        {
          $: {
            'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
            'android:value':
              'Pomodoro focus timer lock-screen countdown and controls',
          },
        },
      ],
    };
    app.service.push(service);
  } else {
    service.$ = {
      ...service.$,
      'android:exported': service.$['android:exported'] ?? 'false',
      'android:foregroundServiceType': 'specialUse',
      'tools:replace': 'android:foregroundServiceType',
    };
    if (!service.property) service.property = [];
    const hasSubtype = service.property.some(
      (p) =>
        p.$?.['android:name'] ===
        'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
    );
    if (!hasSubtype) {
      service.property.push({
        $: {
          'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
          'android:value':
            'Pomodoro focus timer lock-screen countdown and controls',
        },
      });
    }
  }

  const manifest = androidManifest.manifest.$ ?? {};
  if (!manifest['xmlns:tools']) {
    manifest['xmlns:tools'] = 'http://schemas.android.com/tools';
    androidManifest.manifest.$ = manifest;
  }
}

function withFocusTimerManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    ensurePermission(manifest, 'android.permission.FOREGROUND_SERVICE');
    ensurePermission(
      manifest,
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    );
    ensurePermission(manifest, 'android.permission.POST_NOTIFICATIONS');
    // Android 16+ Live Update / status-bar chip (Clock stopwatch-style).
    ensurePermission(manifest, 'android.permission.POST_PROMOTED_NOTIFICATIONS');
    ensureServiceType(manifest);
    return cfg;
  });
}

function withStickyChronometerPatch(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const src = path.join(
        cfg.modRequest.projectRoot,
        'plugins/android-patches/StickyNotificationHelper.kt',
      );
      const dest = path.join(
        cfg.modRequest.projectRoot,
        'node_modules/react-native-sticky-notification/android/src/main/java/com/stickynotification/StickyNotificationHelper.kt',
      );
      if (fs.existsSync(src) && fs.existsSync(path.dirname(dest))) {
        fs.copyFileSync(src, dest);
      }
      return cfg;
    },
  ]);
}

function withFocusTimerDrawable(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/res/drawable',
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'ic_stat_focus.xml'), VECTOR_ICON);
      return cfg;
    },
  ]);
}

function withAndroidFocusTimer(config) {
  config = withFocusTimerManifest(config);
  config = withFocusTimerDrawable(config);
  config = withStickyChronometerPatch(config);
  return config;
}

module.exports = createRunOncePlugin(
  withAndroidFocusTimer,
  PACKAGE,
  '1.0.0',
);
