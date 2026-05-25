# Virio · Style Guide for UI Edits

You are editing the Virio UI. Virio is wallet-native recurring payments infrastructure for crypto — Stripe Billing for stablecoins. Every edit should feel like infrastructure: calm, premium, intelligent. Reference points: Stripe, Linear, Vercel, Mercury, Arc.

Avoid: meme crypto aesthetics, neon, gradients beyond muted radials, rockets, charts, generic SaaS templates, AI-flavored purple, overlapping chaos.

## Design tokens

Always use these CSS variables. Never hardcode hex values inline.

```css
:root {
  /* light */
  --bg: #FFFFFF;
  --bg-soft: #F7F8FA;
  --text: #0A0A0A;
  --text-2: #5F6368;
  --border: #E7E9EE;

  /* dark */
  --bg-dark: #0B0D10;
  --surface-dark: #111318;
  --elevated-dark: #171A21;
  --text-dark: #F5F7FA;
  --text-2-dark: #9CA3AF;
  --border-dark: #23262D;

  /* accents — use sparingly */
  --emerald: #3DD9A4;   /* primary accent: status, CTAs, single emphasis word */
  --blue: #5CAEFF;      /* secondary: code highlights, ambient glows */
}
```

Emerald and blue are restraint colors. Use them for a single status dot, one highlighted word in a headline, or a primary CTA — never as backgrounds or borders on multiple elements.

## Typography

- Font: Inter (or Geist if available). System fallback: `ui-sans-serif, -apple-system, "SF Pro Display", system-ui`
- Mono: `ui-monospace, "SF Mono", Menlo, "JetBrains Mono"`
- Headlines: weight 600, tight tracking `-0.035em` to `-0.045em`, line-height 1.0–1.06
- Body: weight 400, line-height 1.5–1.55
- Lowercase-friendly. Sentence case or all lowercase. Avoid Title Case.
- Hierarchy is achieved through size and weight, not color.

## Layout

- Generous whitespace. Padding on cards: 16–24px. Section padding: 48–96px.
- Borders: 1px solid `var(--border)`. Never thicker.
- Radii: 8px (small elements), 12–14px (cards), 16–22px (large surfaces), 999px (pills).
- Shadows are subtle:
  - Light: `0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -8px rgba(10,10,10,0.08)`
  - Dark elevated: `0 24px 48px -12px rgba(0,0,0,0.6)`
- Cards: thin border + soft shadow + radius. No heavy fills.
- Grids: align everything. Whitespace is the layout, not decoration.

## Components

- **Buttons (primary):** emerald background `#3DD9A4`, text `#06291F`, weight 600, radius 10px, padding `11px 16px`. No shadow.
- **Buttons (secondary):** transparent background, 1px border, text color matches theme.
- **Inputs:** 1px border, radius 10px, padding `10px 14px`, no inner shadow.
- **Status indicators:** 6–8px emerald dot with `box-shadow: 0 0 8–14px var(--emerald)` for glow. Used for "active", "live", "settled".
- **Code blocks:** monospace, dark surface `#111318`, 1px border, radius 12–14px, syntax colors — `--text-2-dark` for keywords, `--blue` for variables, `--emerald` for functions, `#E0B872` for strings.
- **Cards:** the universal container. Border + radius + optional `--bg-soft` fill. Never gradients.

## Motion

- Transitions: 150–250ms ease-out. Nothing snappier, nothing slower.
- Hover states: subtle opacity shift, border color brighten, or 1–2px translate. No scale, no bounce.
- Loading: pulse opacity 0.5 → 1.0, never spinners with branded colors.
- Forbidden: bounce, elastic, glitch, flash, anything attention-grabbing.

## Copy tone

- Short. Confident. Infrastructure-oriented.
- Lowercase when in marketing surfaces. Sentence case in product UI.
- Forbidden phrases: "revolutionary", "game-changing", "to the moon", "next-gen", excessive crypto jargon.
- Good examples: "recurring payments for programmable money", "stablecoin billing infrastructure", "wallet-native subscriptions", "autonomous payment execution".

## Iconography

- Logomark: see `virio-logo.svg`. Use the loop mark for app icons, favicons, navigation, and brand lockups.
- Icons in UI: Lucide or Phosphor at 16–20px, stroke weight 1.5, color matches text-2 unless active.
- Never use emoji as UI icons.

## What to do when editing

1. Read the existing component first. Match the patterns already there.
1. If a value is hardcoded (color, spacing, radius), replace with the appropriate token.
1. Whenever you add a new color, ask: is this really needed? Default to greyscale.
1. Test light and dark mode. Both must work.
1. If you're tempted to add a gradient, decoration, or visual flourish — don't. Whitespace is the design.

## Brand voice in error states

Errors are calm, not alarming. "we couldn't process this subscription" not "ERROR! Transaction failed!". Provide the next step.
