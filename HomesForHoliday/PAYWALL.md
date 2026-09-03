# Directory unlock — £5.95 / 30 days, no database

Browsing stays free and fully indexable; the link through to each owner's own
website is what's paid for.

This branch replaces Postgres with a signed token. There is nothing to
provision, nothing to keep running between purchases, and no customer data at
rest. The two things that made the database worth having — revoking a shared
link, and capping devices — are gone, deliberately. At £5.95 they cost more to
run than they save.

## How it holds together

```
region page  →  <a href="/go/lanner-cornwall">      no owner URL in the HTML
     ↓
/go/:slug    →  rewrite → /api/go/[slug]            (vercel.json)
     ↓
gate         →  cookie? signature valid? in date? →  302 to the owner URL
```

**The gate runs server-side, before the owner URL is in any response.** The
browser only ever receives a `302` with a `Location` header, and only once the
token has been checked. Owner URLs live in `api/_catalogue.js` and nowhere
else — `npm test` fails the build if one appears in any file that would be
deployed.

`js/unlock.js` picks which panel to show. It is **not** the paywall and holds no
owner URLs.

### The token — this is what replaces the database

```
payload = base64url({ v:1, e:"buyer@email.com", x:1793827200 })   // e = email, x = expiry
token   = payload + "." + base64url(HMAC_SHA256(payload, ACCESS_SECRET))
```

Verifying is arithmetic: recompute the signature, compare it in constant time,
check the expiry is in the future. Change a character of the payload and the
signature no longer matches. Web Crypto rather than `node:crypto`, so the same
helper would still work if the gate ever moved into Edge middleware.

The cookie is `hfh_access` — `HttpOnly`, `Secure`, `SameSite=Lax`, 32 days, so
it outlives the 30-day window by enough for the panel to say "your access ran
out on the 3rd" rather than showing a blank paywall.

### Where the customer record lives

Stripe. It already knows who paid, how much and when, so `/api/recover` looks
the buyer up there, works out how much of their 30 days is left, and re-sends
the link. That closes the obvious hole in a no-database design — losing the
email no longer means losing what you paid for.

## The flow

1. Visitor clicks **Unlock the Directory — £5.95** → `POST /api/checkout`
2. Stripe Checkout (card / Apple Pay / Google Pay), with the consent tick-box
   for immediate access and loss of the 14-day cancellation right
3. Stripe returns to `/api/activate?cs=…` → confirms the payment **with Stripe**,
   mints the token, sets the cookie → straight through to the property they
   wanted. No inbox trip.
4. Signature-verified webhook → `/api/stripe-webhook` → emails the 30-day link,
   which works on any device
5. Emailed link → `/api/unlock?t=…` → verifies → sets the cookie → directory
6. Lost the email → `/api/recover` → Stripe lookup → sends it again

Buying twice extends rather than resets, in both `/api/activate` (from the
cookie) and the webhook (from Stripe's earlier sessions).

## Files

| File | Purpose |
| --- | --- |
| `lib/token.js` | `sign()` / `verify()` / `peek()`, and the cookie helpers |
| `lib/email.js` | Sends the access link through Resend |
| `lib/throttle.js` | Best-effort burst limit — in memory, see below |
| `api/_catalogue.js` | **Generated.** slug → owner URL. Inside `api/` so it is function source, not static output |
| `api/go/[slug].js` | The gate |
| `api/checkout.js` | Creates the Stripe Checkout Session |
| `api/activate.js` | Back from Stripe → confirms payment → cookie → instant access |
| `api/stripe-webhook.js` | Verifies the signature → emails the link |
| `api/unlock.js` | Emailed link → cookie → directory |
| `api/recover.js` | Re-sends the link, using Stripe as the record |
| `api/me.js` | Cookie state for the unlock panel. No lookups |
| `api/signout.js` | Clears the cookie on this device |

## Setup

### 1. Environment variables

Copy from `.env.example` into Vercel → Settings → Environment Variables.

```bash
npm run secret     # generates an ACCESS_SECRET
```

Rotating `ACCESS_SECRET` invalidates every live token, so only do it if the
secret leaks — and expect to re-send links to anyone mid-window.

### 2. Stripe

- Webhook endpoint `https://<site>/api/stripe-webhook`, event
  `checkout.session.completed`. Copy the signing secret.
- Test mode first. Only swap to live keys after the manual plan below passes.

### 3. Resend

Verify a sending domain and configure **SPF and DKIM**. This matters more than
usual: the email is how a buyer gets in on a second device and how they recover
access, so a code that lands in spam is a paying customer locked out.

### 4. Regenerating the catalogue

```bash
npm run catalogue    # from properties.csv — validates first, refuses on errors
npm run links        # from scripts/properties.json — used while the CSV has errors outstanding
```

Run one of these whenever properties change, then deploy. Slugs are stable, so
existing links don't shift when the list grows.

## Test plan

`npm test` covers everything that can be checked without credentials — 27
checks, including the ways this could silently give the product away:

- no owner domain in any `.html`, in `js/`, or in **any file Vercel would
  upload** (the check reads `.vercelignore`, so weakening that fails the build)
- all 84 cards point at `/go/<slug>`, and every slug has a catalogue entry
- unauthenticated `/go/<slug>` returns a 302 to the unlock panel, empty body, no
  owner domain anywhere in the response — for all 84 slugs
- expired tokens, tampered payloads, tampered signatures and tokens signed with
  a different secret are all rejected at the gate
- a valid token does reach the owner URL — the gate is proved to work, not just
  proved to refuse
- gate responses are `no-store` and `noindex`; `robots.txt` disallows `/go/`
  and `/api/`

The rest needs real accounts and must be done before any live money:

1. Stripe test mode end to end, including a declined card
2. Gate holds in a private window with no cookie
3. `curl -s https://<site>/united-kingdom.html | grep -o 'href="[^"]*"' | grep http`
   — no owner domains
4. **Confirm `/scripts/properties.json` and `/properties.csv` 404 on the
   deployed site.** `.vercelignore` should keep them out of the upload
   entirely; verify it rather than assume it
5. Access expires: mint a token with a one-minute expiry, confirm lockout
6. The emailed link works on a different device and network
7. Re-send via "Send my link again" works, and does **not** extend the window
8. Free pages work fully with no cookie
9. One real £5.95 purchase, then refund it

## Decisions worth knowing

**Owner URLs in `api/`, not in a data file.** Vercel serves the project root as
static output, so a `data/properties.json` would have been a public URL — the
whole product, free. Files under `api/` are function source. `.vercelignore` and
a `npm run test` check both back this up.

**The webhook sends the email; the redirect grants access.** Two paths on
purpose: the buyer is through immediately on the browser they paid on, and the
email covers every other device. Neither depends on the other.

**Stripe is the customer record.** No table of members, and no "we deleted your
account" problem — there is nothing to delete.

## What this design gives up

- **Links can be shared, and cannot be revoked.** The buyer's email is bound
  into the token and shown on the unlock panel, which discourages casual
  sharing, but nothing stops it. At £5.95, chasing it costs more than it saves.
- **No device cap.** It needs shared state; there isn't any.
- **The burst limit is best-effort.** `lib/throttle.js` lives in the memory of
  one warm function instance, so it resets on a cold start and doesn't see
  requests handled elsewhere. It costs a scraper something and a real visitor
  nothing.
- **No click analytics.** Nothing records which properties get opened, so
  "which regions are people actually looking at" can't be answered from here.
- **No auto-renew.** Month two means buying again — which is the repeat-purchase
  model Gary wants, but it is not recurring revenue.

If sharing ever looks like a real problem, the fix is to put a small store
behind the gate — not to tighten these numbers.

## Still needed before go-live

- [ ] Stripe account with Gary's bank details
- [ ] Resend account and a verified sending domain (SPF + DKIM)
- [ ] `ACCESS_SECRET` generated and set in Vercel
- [ ] **VAT answer** — if VLA Media Ltd is VAT registered, £5.95 must be
      VAT-inclusive; the price constant is `PRICE_PENCE` in `api/checkout.js`
- [ ] **Solicitor review** of the refunds section in `terms.html` and the
      directory-access section in `privacy-policy.html` — both are drafts, and
      the privacy one was rewritten on this branch because the data it
      described no longer exists
