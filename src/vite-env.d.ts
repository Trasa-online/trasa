/// <reference types="vite/client" />
/// <reference types="google.maps" />

interface Window {
  gtag?: (...args: unknown[]) => void;
  _clarityInit?: () => void;
  _clarityReady?: boolean;
}

declare namespace NodeJS {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Timeout {}
}
