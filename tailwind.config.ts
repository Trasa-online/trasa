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
        // Toned-down orange: same hue, lower saturation + lightness
        // Replaces Tailwind's vivid orange-600 (#ea580c) with a darker burnt orange
        orange: {
          50:  "hsl(30, 70%, 97%)",
          100: "hsl(27, 65%, 92%)",
          200: "hsl(25, 60%, 83%)",
          300: "hsl(23, 62%, 69%)",
          400: "hsl(22, 65%, 55%)",
          500: "hsl(21, 70%, 44%)",
          600: "hsl(21, 72%, 36%)",  // was #ea580c — now darker, less vivid
          700: "hsl(21, 74%, 28%)",
          800: "hsl(21, 70%, 22%)",
          900: "hsl(21, 68%, 17%)",
          950: "hsl(22, 72%, 10%)",
        },
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "orb-flow": "orb-flow 3.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
