import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
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
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",

        // The Virio accent — emerald, used sparingly per the style guide.
        virio: {
          emerald: "#3DD9A4",
          "emerald-ink": "#06291F",
          blue: "#5CAEFF",
        },

        // `brand-*` is intentionally a near-neutral grey scale. Existing code
        // referencing brand-300/500/600 reads as a quiet neutral accent; the
        // single emerald accent lives under `virio-*` or `primary`.
        brand: {
          50:  "#FAFAFB",
          100: "#F4F5F7",
          200: "#E7E9EE",
          300: "#C9CCD2",
          400: "#9CA3AF",
          500: "#5F6368",
          600: "#3A3D43",
          700: "#23262D",
          800: "#171A21",
          900: "#0B0D10",
        },
      },
      spacing: {
        "px-1": "4px",
        "px-2": "8px",
        "px-3": "12px",
        "px-4": "16px",
        "px-6": "24px",
        "px-8": "32px",
        "px-12": "48px",
        "px-16": "64px",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      fontSize: {
        "2xs":   ["11px", { lineHeight: "16px", letterSpacing: "0.02em" }],
        xs:      ["12px", { lineHeight: "16px" }],
        sm:      ["13px", { lineHeight: "20px" }],
        base:    ["14px", { lineHeight: "20px" }],
        lg:      ["16px", { lineHeight: "24px" }],
        xl:      ["20px", { lineHeight: "28px" }],
        "2xl":   ["26px", { lineHeight: "30px", letterSpacing: "-0.035em" }],
        "3xl":   ["36px", { lineHeight: "38px", letterSpacing: "-0.04em" }],
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-inter-tight)", "var(--font-inter)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular"],
      },
      boxShadow: {
        e1: "var(--elevation-1)",
        e2: "var(--elevation-2)",
        e3: "var(--elevation-3)",
        soft: "var(--elevation-1)",
        lift: "var(--elevation-3)",
      },
      transitionDuration: {
        fast: "var(--motion-fast)",
        DEFAULT: "var(--motion-base)",
        slow: "var(--motion-slow)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
        soft: "cubic-bezier(0.4, 0, 0.2, 1)",
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "page-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "modal-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "overlay-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "toast-out": {
          to: { opacity: "0", transform: "translateY(8px)" },
        },
        "row-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        ripple: { to: { transform: "scale(2.5)", opacity: "0" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.98)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "ticker-up": {
          from: { transform: "translateY(4px)", opacity: "0" },
          to:   { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "page-in": "page-in 0.25s ease-out both",
        "modal-in": "modal-in 0.2s ease-out both",
        "overlay-in": "overlay-in 0.18s ease-out both",
        "toast-in": "toast-in 0.2s ease-out both",
        "toast-out": "toast-out 0.18s ease-out forwards",
        "row-in": "row-in 0.25s ease-out both",
        ripple: "ripple 0.65s cubic-bezier(0.16,1,0.3,1)",
        "fade-up": "fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "scale-in": "scale-in 0.2s ease-out both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
        "ticker-up": "ticker-up 0.25s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
