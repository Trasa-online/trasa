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
      // Pomarańcz brandu (#F75708) - splash = pełny pomarańczowy ekran z białym symbolem
      // spontaway. Tło musi być pomarańczowe (nie biel), żeby ewentualny letterbox wokół
      // obrazu splasha też był pomarańczowy (bezszwowo z symbolem).
      backgroundColor: '#F75708',
      // No spinner — splash image only
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashImmersive: false,
      splashFullScreen: false,
    },
    Keyboard: {
      // 'native' - iOS sam przesuwa viewport gdy klawiatura sie pokazuje
      // (bez recznego 100vh workaroundu w CSS). Inputy w dolnej polowie ekranu
      // (CityPicker, UserSearch, EditPlan) nie sa zaslaniane przez klawiature.
      resize: 'native',
      // Klawiatura ma styl native iOS (jasna na jasnym tle, ciemna na ciemnym)
      style: 'default',
      // Wymusza rerender contentu po pojawieniu klawiatury - czasem fix dla
      // niespodziewanych blank spaces u dolu ekranu.
      resizeOnFullScreen: true,
    },
  },
};

export default config;
