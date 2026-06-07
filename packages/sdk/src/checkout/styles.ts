import type { CSSProperties } from "react";

// Inline style objects keep the SDK drop-in: a merchant adds the component and
// gets a finished UI with zero CSS imports or Tailwind config. The same object
// drives both the React modal (`style={...}`) and the vanilla DOM modal
// (`Object.assign(el.style, ...)`), so every value is a CSS string with units —
// numbers would get an automatic `px` from React but not from the DOM. The
// `react` import is type-only and erased at build, so the vanilla bundle pulls
// in no React.

export const styles: Record<string, CSSProperties> = {
  // ── Default button (spec §"Default Button Design") ──
  button: {
    background: "#fff",
    color: "#000",
    border: "1px solid #000",
    borderRadius: "12px",
    padding: "12px 18px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "15px",
    lineHeight: "1.2",
  },
  buttonDisabled: {
    opacity: "0.5",
    cursor: "not-allowed",
  },

  // ── Modal shell ──
  overlay: {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.5)",
    padding: "16px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: "380px",
    background: "#fff",
    color: "#000",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
    outline: "none",
  },
  close: {
    position: "absolute",
    top: "14px",
    right: "14px",
    width: "28px",
    height: "28px",
    display: "grid",
    placeItems: "center",
    border: "none",
    background: "transparent",
    color: "#666",
    fontSize: "20px",
    lineHeight: "1",
    cursor: "pointer",
    borderRadius: "6px",
  },

  // ── Typography ──
  title: {
    margin: "4px 0 6px",
    fontSize: "20px",
    fontWeight: "700",
    letterSpacing: "-0.01em",
  },
  subtitle: {
    margin: "0",
    fontSize: "14px",
    color: "#555",
    lineHeight: "1.45",
  },

  // ── Connect options ──
  options: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "20px",
  },
  option: {
    width: "100%",
    textAlign: "left",
    padding: "14px 16px",
    border: "1px solid #e3e3e3",
    borderRadius: "12px",
    background: "#fff",
    color: "#000",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  optionHint: {
    display: "block",
    marginTop: "2px",
    fontSize: "12px",
    fontWeight: "400",
    color: "#777",
  },

  // ── Primary action (Done / Create Subscription) ──
  primary: {
    width: "100%",
    marginTop: "20px",
    padding: "12px 18px",
    border: "1px solid #000",
    borderRadius: "12px",
    background: "#000",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
  },

  // ── Plan summary ──
  summary: {
    marginTop: "20px",
    padding: "16px",
    border: "1px solid #eee",
    borderRadius: "12px",
    background: "#fafafa",
  },
  summaryAmount: {
    fontSize: "26px",
    fontWeight: "700",
    letterSpacing: "-0.02em",
  },
  summaryInterval: {
    marginTop: "2px",
    fontSize: "14px",
    color: "#555",
  },

  // ── QR + status ──
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    marginTop: "20px",
  },
  qr: {
    width: "232px",
    height: "232px",
    borderRadius: "12px",
    border: "1px solid #eee",
  },
  spinner: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "3px solid #e6e6e6",
    borderTopColor: "#000",
    animation: "virio-spin 0.8s linear infinite",
  },
  statusText: {
    fontSize: "14px",
    color: "#555",
  },
  successIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "#0a7d33",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontSize: "22px",
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
