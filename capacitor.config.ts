import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android packaging (Capacitor wraps the built web app in a native WebView app).
 *
 * `appId` is the Play Store application ID. It is permanent once the app is published:
 * decide on the final value BEFORE the first upload. See docs/ANDROID_RELEASE.md.
 */
const config: CapacitorConfig = {
  appId: 'com.buildingmistry.app',
  appName: 'Mistry',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
