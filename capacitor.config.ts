import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aforaudience.app',
  appName: 'AforAudience',
  webDir: 'out',
  server: {
    url: 'https://www.aforaudience.com',
    cleartext: false,
  },
};

export default config;
