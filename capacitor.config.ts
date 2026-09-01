import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'travel.trasa.app',
  appName: 'spontaway',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // Max time splash can stay (safety fallback). We hide manually before this.
      launchShowDuration: 4000,
      // We control hide() from JS once app is ready
      launchAutoHide: false,
      // Smooth fade-out
      launchFadeOutDuration: 300,
      // Splash = JEDNOLITE tło #FEFEFE, BEZ znaku (zmiana 2026-09-01, zastąpiło żółto-złoty
      // gradient z 2026-08-12). Znak rysuje teraz React (SplashDraw: symbol wjeżdża od lewej
      // i kończy na pinezce), więc natywny ekran ma tylko utrzymać kolor, zanim WebView odmaluje
      // pierwszą klatkę. Gdyby niósł statyczne logo, w momencie podmiany widać by było skok
      // rozmiaru albo dwa loga naraz - dokładnie ten problem, przez który React splash był
      // wcześniej wyłączony na natywnym.
      backgroundColor: '#FEFEFE',
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
