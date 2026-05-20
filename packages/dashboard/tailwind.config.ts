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
        brand: {
          50:  "#f1f0ff",
          100: "#e6e4ff",
          200: "#d0cbff",
          300: "#aea6ff",
          400: "#8c80ff",
          500: "#635bff",
          600: "#5248d6",
          700: "#4338ca",
          800: "#372fa6",
          900: "#2b2580",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        electric: {
          50: "#e8f3ff",
          100: "#cfe6ff",
          200: "#9fccff",
          300: "#5fadff",
          400: "#2b95ff",
          500: "#0a84ff",
          600: "#0067d6",
          700: "#0050a8",
          800: "#063e80",
          900: "#0a2f5e",
        },
      },
      // strict 4/8 spacing scale — additive (Tailwind defaults still exist).
      // Use these where intentional rhythm matters.
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
        // locked 8-step scale: 11 / 12 / 13 / 14 / 16 / 20 / 26 / 36
        "2xs":   ["11px", { lineHeight: "16px", letterSpacing: "0.02em" }],
        xs:      ["12px", { lineHeight: "16px" }],
        sm:      ["13px", { lineHeight: "20px" }],
        base:    ["14px", { lineHeight: "20px" }],
        lg:      ["16px", { lineHeight: "24px" }],
        xl:      ["20px", { lineHeight: "28px" }],
        "2xl":   ["26px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
        "3xl":   ["36px", { lineHeight: "40px", letterSpacing: "-0.02em" }],
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-inter-tight)", "var(--font-inter)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg,#7a73ff 0%,#635bff 45%,#4b3df2 100%)",
        "brand-gradient-hover": "linear-gradient(135deg,#8b85ff 0%,#6f67ff 45%,#5346ff 100%)",
        "hero-mesh":
          "radial-gradient(1200px 600px at 0% -20%, rgba(99,91,255,0.18), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(0,212,255,0.12), transparent 55%), radial-gradient(700px 400px at 50% 100%, rgba(142,123,255,0.10), transparent 50%)",
      },
      boxShadow: {
        // monochrome elevation scale — what dashboard components should use
        "e1": "var(--elevation-1)",
        "e2": "var(--elevation-2)",
        "e3": "var(--elevation-3)",
        // legacy aliases (kept so marketing pages don't break)
        brand: "0 8px 24px -6px rgba(99,91,255,0.45), 0 2px 6px -1px rgba(99,91,255,0.25)",
        "brand-lg": "0 12px 28px -6px rgba(99,91,255,0.55), 0 4px 10px -2px rgba(99,91,255,0.25)",
        soft: "var(--elevation-1)",
        lift: "var(--elevation-3)",
        glow: "0 0 0 1px rgba(99,91,255,0.12), 0 0 40px -8px rgba(99,91,255,0.35)",
      },
      transitionDuration: {
        fast: "var(--motion-fast)",
        DEFAULT: "var(--motion-base)",
        slow: "var(--motion-slow)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
        soft: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        "page-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "modal-in": {
          "0%": { opacity: "0", transform: "translateY(20px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "overlay-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateX(40px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        "toast-out": {
          to: { opacity: "0", transform: "translateX(40px) scale(0.96)" },
        },
        "row-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        flash: {
          "0%": { background: "rgba(99,91,255,0.18)" },
          "100%": { background: "transparent" },
        },
        ripple: { to: { transform: "scale(2.5)", opacity: "0" } },
        "live-ping": {
          "0%": { transform: "scale(1)", opacity: "0.5" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
        "virio-dot": {
          "0%, 100%": { opacity: "0.95" },
          "50%": { opacity: "0.5" },
        },
        drift1: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "33%":      { transform: "translate(180px,120px) scale(1.1)" },
          "66%":      { transform: "translate(60px,220px) scale(0.95)" },
        },
        drift2: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "50%":      { transform: "translate(-200px,-120px) scale(1.15)" },
        },
        "slide-down": {
          from: { transform: "translateY(-100%)", opacity: "0" },
          to:   { transform: "translateY(0)",     opacity: "1" },
        },
        spin: { to: { transform: "rotate(360deg)" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(22px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-10px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "50%":      { transform: "translateY(-16px) translateX(8px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "border-flow": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":      { backgroundPosition: "100% 50%" },
        },
        "virio-ring": {
          "0%":   { transform: "scale(0.8)", opacity: "0.7" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        "ticker-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to:   { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "page-in": "page-in 0.45s cubic-bezier(0.16,1,0.3,1) both",
        "modal-in": "modal-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both",
        "overlay-in": "overlay-in 0.25s ease-out both",
        "toast-in": "toast-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
        "toast-out": "toast-out 0.3s ease-out forwards",
        "row-in": "row-in 0.45s cubic-bezier(0.16,1,0.3,1) both",
        flash: "flash 1.6s ease-out",
        ripple: "ripple 0.65s cubic-bezier(0.16,1,0.3,1)",
        "live-ping": "live-ping 1.6s ease-out infinite",
        "virio-dot": "virio-dot 2s ease-in-out infinite",
        drift1: "drift1 24s ease-in-out infinite",
        drift2: "drift2 28s ease-in-out infinite",
        "slide-down": "slide-down 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        "spin-slow": "spin 4s linear infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.8s ease-out both",
        "scale-in": "scale-in 0.5s cubic-bezier(0.16,1,0.3,1) both",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float-slow 9s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
        "border-flow": "border-flow 6s ease infinite",
        "virio-ring": "virio-ring 2s cubic-bezier(0.16,1,0.3,1) infinite",
        "ticker-up": "ticker-up 0.4s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
