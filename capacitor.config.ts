import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'travel.trasa.app',
  appName: 'Trasa',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // Max time splash can stay (safety fallback). We hide manually before this.
      launchShowDuration: 4000,
      // We control hide() from JS once app is ready
      launchAutoHide: false,
      // Smooth fade-out
      launchFadeOutDuration: 300,
      // Złamana biel - brand background
      backgroundColor: '#FEFEFE',
      // No spinner — splash image only
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashImmersive: false,
      splashFullScreen: false,
    },
  },
};

export default config;
