---
name: Home for Holiday
description: A curated directory of exclusive holiday homes, booked direct with the owner.
colors:
  navy: "#122248"
  navy-deep: "#0b1730"
  primary: "#24379b"
  primary-bright: "#3f5fd6"
  sky: "#5aa0e6"
  aqua: "#0f9e94"
  aqua-light: "#6ff0e6"
  amber: "#b26a00"
  amber-bright: "#e0951f"
  ink: "#16203a"
  muted: "#5b6478"
  outline-variant: "#b9c0d0"
  surface: "#f6f8fc"
  pearl: "#ffffff"
  container-low: "#eef2f9"
  container: "#e7edf7"
typography:
  headline:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.9rem, 4vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.4rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, Hanken Grotesk, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.14em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  xxl: "28px"
  pill: "999px"
spacing:
  gutter: "40px"
  section: "clamp(60px, 9vw, 120px)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "14px 26px"
  button-amber:
    backgroundColor: "{colors.amber}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "14px 26px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: "14px 26px"
  dest-card:
    backgroundColor: "{colors.pearl}"
    rounded: "{rounded.xxl}"
  prop-card:
    backgroundColor: "{colors.pearl}"
    rounded: "{rounded.lg}"
    padding: "22px"
---

# Design System: Home for Holiday

## Overview

**Creative North Star: "Crystalline Bento"**

Home for Holiday reads as premium and trustworthy: a polished, credible, faintly aspirational directory that has to earn confidence against agencies and OTAs on the strength of its own presentation, since it has no booking engine of its own to lean on. The system pairs a deep brand navy with a bento-grid structure of frosted-glass cards floating over a soft, luminous mesh-gradient backdrop — destinations, USPs, and steps are all presented as discrete tiles rather than continuous editorial flow, giving the site a curated, catalog-like rhythm that echoes "handpicked" and "exclusive" from the copy.

Imagery carries the emotional weight (full-bleed hero photography, destination and property photos), while the UI chrome stays quiet and structural: navy for authority and trust, aqua as a sparing highlight (rules, hover accents, active states), amber reserved for money-adjacent moments (fees, pricing) to differentiate them from primary navigation actions.

The glass-and-soft-shadow treatment (frosted `backdrop-filter` cards, navy-tinted ambient shadows) is the current signature but is explicitly **open to evolve** — it is not a locked invariant. Future work may simplify or replace it as long as the navy identity, bento structure, and premium/trustworthy tone survive.

**Key Characteristics:**
- Deep navy (#122248) as the anchor brand color, applied to text, footer, gradients, and dark overlays — never as a large flat background on light pages.
- Bento-grid tiling for destinations, USPs, and steps; content is chunked into discrete cards, not long-form flow.
- Frosted-glass surfaces over a soft radial-gradient mesh background (currently signature, open to change).
- Full-bleed photography carries emotion; UI chrome stays restrained and structural.
- Aqua as a rare accent (rules, active underlines, hover glints); amber reserved specifically for pricing/fee-related copy.

## Colors

A cool, navy-anchored palette with one warm accent (amber) held in reserve for money moments, plus a low-saturation aqua used sparingly as the "attention" accent.

### Primary
- **Brand Navy** (`#122248`): The core identity color — footer background, dark gradients, header ink on scroll, dark overlay scrims over hero imagery. Not used as a large light-page background.
- **Navy Deep** (`#0b1730`): Deepest shade, used at gradient starts (footer mesh, CTA band) for extra depth.
- **Signal Blue** (`#24379b`): The interactive/UI primary — primary buttons, links, active nav states, icon tints. This is the color users click.
- **Bright Blue** (`#3f5fd6`): Gradient partner to Signal Blue on primary buttons and glow shadows; adds lift without introducing a new hue.
- **Sky** (`#5aa0e6`): Supporting tint in the ambient mesh-gradient background.

### Secondary
- **Aqua** (`#0f9e94`) / **Aqua Light** (`#6ff0e6`): The "attention" accent — eyebrow rule underlines, active nav underline, hover-state icon color, footer headings. Used narrowly and consistently as the one non-navy signal color.

### Tertiary
- **Amber** (`#b26a00`) / **Amber Bright** (`#e0951f`): Reserved specifically for money-adjacent content — the owners' pricing callout, the amber CTA button variant. Do not use amber for general navigation or decoration; its scarcity is what makes it read as "price."

### Neutral
- **Ink** (`#16203a`): Primary text color on light surfaces.
- **Muted** (`#5b6478`): Secondary/supporting text — paragraph copy, labels, metadata.
- **Outline Variant** (`#b9c0d0`): Breadcrumb separators and quiet dividers.
- **Surface** (`#f6f8fc`): Page background (cool, airy off-white).
- **Pearl** (`#ffffff`): Card and form backgrounds needing full contrast against Surface.
- **Container / Container Low** (`#e7edf7` / `#eef2f9`): Soft-fill panels (e.g. the "soft" note under sold-out-style property cards).

### Named Rules
**The Amber Reserve Rule.** Amber appears only where money is the subject (pricing, fees, the owners' rate callout). It never substitutes for the primary blue on ordinary CTAs — its rarity is what signals "this is a price."

## Typography

**Body/Display Font:** Hanken Grotesk (with system sans-serif fallback)
**Label Font:** Geist (falls back to Hanken Grotesk)

**Character:** A single confident grotesk carries both display and body duty — heavy weight (800) and tight tracking (-0.02em to -0.03em) at headline sizes reads assertive and modern; Geist is reserved for small uppercase labels/eyebrows, giving those a slightly more technical, catalog-tag feel distinct from the headline voice.

### Hierarchy
- **Hero Display** (800, `clamp(2.5rem, 6.2vw, 4.8rem)`, line-height 1.02): Homepage/listing hero H1 only, white on image, max-width 16ch.
- **Headline** (800, `clamp(1.9rem, 4vw, 3rem)`, line-height 1.12): Section H2s.
- **Title** (700, 1.4rem–1.8rem): Card and sub-section H3s (destination cards, hub cards, property cards).
- **Body** (400, 17px, line-height 1.6): Paragraph copy; body text uses Muted, not Ink, for a softer secondary read.
- **Label** (600, 0.72rem, letter-spacing 0.14em, uppercase, Geist): Eyebrows, field labels, badges, footer headings — always uppercase with wide tracking.

### Named Rules
**The One Voice, Two Registers Rule.** Hanken Grotesk carries every reading size; Geist appears only at label scale (≤0.82rem) and always uppercase. Never use Geist for body copy or headlines.

## Layout

Content sits in a `1220px` max-width container with a `40px` gutter (`28px` at ≤1024px, `18px` at ≤620px). Sections use generous vertical rhythm (`clamp(60px, 9vw, 120px)` padding), reinforcing the catalog/directory pacing rather than a dense app feel. The dominant grid unit is the **bento tile**: 4-column grids for destinations/steps collapsing to 2 then 1 column on smaller screens, with occasional `span 2` "wide" or `span 2` row "tall" cards to vary rhythm. Property/hub listing grids use a simpler 3- and 2-column card grid. Mobile nav becomes a full-height slide-in panel from the right rather than a dropdown.

## Elevation & Depth

The system currently conveys depth with a hybrid of frosted glass and soft ambient shadow: `backdrop-filter: blur()` glass panels (nav on scroll, quickbar, USP tiles, steps, contact tiles) sit above a `body::before` radial-gradient mesh, and card lift is signaled by soft, wide, navy-tinted shadows rather than hard drop shadows. This treatment is **explicitly open to change** — it is the current signature, not a protected invariant — so future work may simplify toward flatter or more solid surfaces if that better serves the premium/trustworthy goal.

### Shadow Vocabulary
- **Soft** (`0 14px 34px -20px rgba(26, 42, 108, 0.28)`): Resting-state elevation for cards, tiles, and glass panels.
- **Lift** (`0 34px 70px -34px rgba(26, 42, 108, 0.36)`): Larger elevation for the quickbar and mobile nav panel.
- **Glow** (`0 20px 50px -24px rgba(36, 55, 155, 0.4)`): Hover-state elevation on interactive cards/buttons/tiles — pairs with a small `translateY(-2px to -6px)` lift.

## Shapes

Corners are consistently soft and generous rather than sharp: an escalating radius scale from `8px` (small controls, form inputs) through `12px`/`16px` (buttons' inner elements, quickbar links) up to `22px`–`28px` for major cards (destination tiles, hub cards, split-media images, form cards). Buttons and pill-shaped controls (quickbar, badges, tags) use a full `999px` pill radius. Borders are hairline and low-contrast (`rgba(26,32,58,0.07–0.09)`), used to separate glass surfaces from background rather than to draw attention.

## Components

### Buttons
- **Shape:** Full pill (`border-radius: 999px`), `14px 26px` padding, 700-weight label text.
- **Primary:** Navy-to-bright-blue gradient (`--primary` → `--primary-bright`), white text.
- **Amber:** Amber-to-amber-bright gradient, white text — reserved for pricing/fee-adjacent CTAs (see Amber Reserve Rule).
- **Ghost:** Translucent glass fill, primary-blue text, blue-tinted border; used over imagery/dark surfaces.
- **Glass:** Fully transparent white glass, white text/border; used only on dark hero imagery.
- **Hover/Focus:** All variants lift `translateY(-2px)` and gain the Glow shadow on hover; no separate focus-ring styling currently defined beyond form inputs.

### Cards / Containers
- **Destination / Hub cards:** `22px`–`28px` radius, full-bleed image, dark gradient scrim at the base carrying white title + count label, hover scales the image (`1.06–1.07`) and reveals a "Explore →" affordance.
- **Property cards:** White (Pearl) background, `16px` radius, hairline border, Soft shadow at rest, Glow + lift on hover; structured body with sub-label, title, meta row, and CTA button.
- **Glass tiles** (USP, steps, contact tiles, quickbar): translucent white glass over the mesh background, hairline glass border, Soft shadow, Glow on hover.

### Inputs / Fields
- **Style:** `12px` radius, hairline border, Surface-tinted background at rest.
- **Focus:** Border shifts to primary blue plus a soft `4px` primary-tinted glow ring; background lightens to pure white.
- **Label:** Uppercase Geist label above the field, Muted color.

### Navigation
- **Style:** Fixed, transparent-over-hero header that gains a frosted-glass background and soft shadow once scrolled; nav-ink is white over imagery, navy-adjacent Ink once scrolled. Active link and hover both draw an aqua underline that grows from 0 to full width.
- **Mobile:** Full-height slide-in panel from the right (max 340px / 82vw) with a solid pearl background (no glass), stacked links with hairline dividers, and a dark scrim behind it.

## Do's and Don'ts

### Do:
- **Do** keep amber exclusive to money/pricing content (see Amber Reserve Rule).
- **Do** use the aqua accent sparingly — rules, underlines, and hover glints, never as a dominant fill.
- **Do** let full-bleed photography carry emotional weight; keep UI chrome navy/neutral and structural.
- **Do** use the pill radius (999px) for every button and badge; use the 8–28px escalating radius scale for everything else.

### Don't:
- **Don't** use Geist at body or headline scale — it's a label-only face.
- **Don't** use navy as a large flat background on light-mode pages; reserve it for footer, overlays, and dark gradients.
- **Don't** treat the frosted-glass/soft-shadow elevation system as fixed — it may be simplified in future work as long as the navy identity and bento structure are preserved.
