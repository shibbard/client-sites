# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dual-sided:

1. **Travellers** browsing the directory for a holiday home worldwide (UK, Europe, USA, Caribbean, Central America) and wanting to book direct with the owner instead of through an agency.
2. **Holiday-home owners** who want to list their property in the directory to reach guests who book direct, and who may also buy a website through the business's web-design partner.

## Product Purpose

Home for Holiday is a curated directory of exclusive holiday homes. It connects travellers directly with property owners so bookings happen without agency fees (agencies can charge up to 35%), and gives owners a channel to list their property and get a website built.

## Positioning

Direct owner-to-guest connection, not an OTA/agency middleman — no agency booking fees, personal and transparent relationship between guest and owner. A neighbouring listings aggregator that routes bookings through itself or charges commission could not truthfully claim this.

## Operating Context

- Static directory site: destination hub pages (UK, Europe, USA, Caribbean, Central America) link out to individual property listings.
- Owners are onboarded via a "For Owners" page that doubles as a lead-gen funnel for an affiliated web-design service (Get Digital Done), priced from £35+VAT/month.
- Content includes a "Travel Tools" resources page and an "About" page with company story.

## Capabilities and Constraints

- No online booking/payment flow on-site; bookings/contact happen direct with the owner (confirmed by "booked direct with the owner" positioning).
- Static HTML/CSS/JS, no build step, no framework (per repo-wide ClientSites conventions) — deploys as a Vercel static site.
- Contact forms typically via Formspree (repo convention).

## Brand Commitments

- Name: "Home for Holiday" (site title/copy) — note the repo folder is `HomesForHoliday`; treat "Home for Holiday" (singular) as the canonical on-page brand name unless corrected.
- Established 2014, based in Devon, UK.
- Brand navy #122248, vectorised "hfh" logo mark (confirmed in recent commit history — see `favicon.svg` / inline SVG logo in header).
- Fonts: Hanken Grotesk + Geist (Google Fonts).

## Evidence on Hand

- Real, operating business with real property listings (per owner confirmation) — property counts shown on-site (e.g. "88 exclusive homes," "34 Homes" in UK, "15" Europe, "6" Caribbean, "29" USA) are genuine figures to preserve, not placeholder content.
- About page: founders are experienced vacation-home owners with global travel experience, based in Devon.
- No testimonials, press, or case studies currently on-site — do not fabricate any.

## Product Principles

1. Preserve the "book direct, no agency fees" positioning in any new copy or feature — it is the core differentiator.
2. Treat both traveller-facing (browse/discover destinations) and owner-facing (list a property, buy a website) journeys as first-class; neither is decorative.
3. Keep the site static and lightweight — no framework/build-step dependency, per repo-wide convention.
4. Real business facts (est. 2014, Devon base, property counts) are truth to preserve exactly, not marketing filler to embellish or invent further.

## Accessibility & Inclusion

No product-specific accessibility requirement beyond standard good practice.
