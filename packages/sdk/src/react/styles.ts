import type { CSSProperties } from "react";

// Inline style objects keep the SDK drop-in: a merchant adds the component and
// gets a finished UI with zero CSS imports or Tailwind config. Merchants who
// want their own look override the button via `className` / `style` / `children`.

export const styles: Record<string, CSSProperties> = {
  // ── Default button (spec §"Default Button Design") ──
  button: {
    background: "#fff",
    color: "#000",
    border: "1px solid #000",
    borderRadius: 12,
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 15,
    lineHeight: 1.2,
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },

  // ── Modal shell ──
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 2147483000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.5)",
    padding: 16,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 380,
    background: "#fff",
    color: "#000",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
    outline: "none",
  },
  close: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    display: "grid",
    placeItems: "center",
    border: "none",
    background: "transparent",
    color: "#666",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    borderRadius: 6,
  },

  // ── Typography ──
  title: {
    margin: "4px 0 6px",
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: "#555",
    lineHeight: 1.45,
  },

  // ── Connect options ──
  options: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 20,
  },
  option: {
    width: "100%",
    textAlign: "left",
    padding: "14px 16px",
    border: "1px solid #e3e3e3",
    borderRadius: 12,
    background: "#fff",
    color: "#000",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  optionHint: {
    display: "block",
    marginTop: 2,
    fontSize: 12,
    fontWeight: 400,
    color: "#777",
  },

  // ── Primary action (Done / Create Subscription) ──
  primary: {
    width: "100%",
    marginTop: 20,
    padding: "12px 18px",
    border: "1px solid #000",
    borderRadius: 12,
    background: "#000",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },

  // ── Plan summary ──
  summary: {
    marginTop: 20,
    padding: 16,
    border: "1px solid #eee",
    borderRadius: 12,
    background: "#fafafa",
  },
  summaryAmount: {
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  summaryInterval: {
    marginTop: 2,
    fontSize: 14,
    color: "#555",
  },

  // ── QR + status ──
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    marginTop: 20,
  },
  qr: {
    width: 232,
    height: 232,
    borderRadius: 12,
    border: "1px solid #eee",
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "3px solid #e6e6e6",
    borderTopColor: "#000",
    animation: "virio-spin 0.8s linear infinite",
  },
  statusText: {
    fontSize: 14,
    color: "#555",
  },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#0a7d33",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontSize: 22,
  },
};

// Keyframes can't live in an inline style object, so the modal renders this once.
// The reduced-motion query honours users who opt out of animation.
export const KEYFRAMES = `
@keyframes virio-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  [data-virio-spinner] { animation: none !important; }
}
`;
