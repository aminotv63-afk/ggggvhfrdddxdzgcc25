import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sultan.kingdomarena',
  appName: 'سلطان البراري',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0c0a09',
    webContentsDebuggingEnabled: true,
  },
};

export default config;
