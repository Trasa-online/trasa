/// <reference types="vite/client" />

// NodeJS.Timeout compatibility for setTimeout/setInterval
declare namespace NodeJS {
  interface Timeout {}
}
