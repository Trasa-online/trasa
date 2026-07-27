import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        star: {
          DEFAULT: "hsl(var(--star))",
          empty: "hsl(var(--star-empty))",
        },
        "cta-accent": {
          DEFAULT: "hsl(var(--cta-accent))",
          foreground: "hsl(var(--cta-accent-foreground))",
        },
        // ── Paleta brandowa B2C: pomarancz (primary) + akcenty z profilu (fiolet,
        // kremowy) + kolor komplementarny dla pomaranczu = turkus. {DEFAULT} = tlo
        // pastelowe, {ink} = kolor ikony/tekstu na tym tle.
        trasa: {
          orange: { DEFAULT: "#F4955E", ink: "#C2410C" },
          violet: { DEFAULT: "#C6BFF4", ink: "#5B4FC4" },
          cream: { DEFAULT: "#DDD6C8", ink: "#8A7E63" },
          teal: { DEFAULT: "#BFE6DE", ink: "#0F766E" },
        },
      },
      fontFamily: {
        // Naglowki B2C - Baloo 2 (zaokraglony, brandowy). Body zostaje systemowy (Inter fallback).
        display: ['"Baloo 2"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "subtle-bounce": {
          "0%, 100%": { transform: "translateY(0)", boxShadow: "0 4px 14px -4px hsl(45 100% 51% / 0.4)" },
          "50%": { transform: "translateY(-3px)", boxShadow: "0 8px 20px -4px hsl(45 100% 51% / 0.5)" },
        },
        "orb-flow": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 24px -4px rgba(212, 81, 19, 0.55)" },
          "50%": { transform: "scale(1.05)", boxShadow: "0 0 36px -2px rgba(249, 102, 43, 0.75)" },
        },
        // Pelny slide-up arkusza od dolu ekranu - drawer wjezdza na BottomNav i go zakrywa.
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        // Miekkie, wolno dryfujace gradienty w tle ekranu logowania (light-mode).
        // Duza amplituda ruchu (zeby dryf byl WIDOCZNY mimo delikatnego koloru).
        "auth-blob": {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(80px, 60px) scale(1.25)" },
          "66%": { transform: "translate(40px, 110px) scale(0.9)" },
        },
        "auth-blob-2": {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1.1)" },
          "33%": { transform: "translate(-90px, 50px) scale(0.85)" },
          "66%": { transform: "translate(-50px, -60px) scale(1.15)" },
        },
        "auth-blob-3": {
          "0%, 100%": { transform: "translate(0px, 0px) scale(0.95)" },
          "33%": { transform: "translate(70px, -70px) scale(1.2)" },
          "66%": { transform: "translate(-40px, -30px) scale(1)" },
        },
        // Wejscie karty USP przy zmianie slajdu (fade + delikatny slide).
        "auth-fade": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "orb-flow": "orb-flow 3.5s ease-in-out infinite",
        "sheet-up": "sheet-up 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        "auth-blob": "auth-blob 14s ease-in-out infinite",
        "auth-blob-2": "auth-blob-2 17s ease-in-out infinite",
        "auth-blob-3": "auth-blob-3 15s ease-in-out infinite",
        "auth-fade": "auth-fade 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
