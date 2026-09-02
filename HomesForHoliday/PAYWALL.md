# Directory unlock — £5.95 / 30 days

Implements the v3 proposal. Browsing stays free and fully indexable; the link
through to each owner's own website is what's paid for.

## How it holds together

```
region page  →  <a href="/go/lanner-cornwall">      no owner URL in the HTML
     ↓
/go/:slug    →  rewrite → /api/go/[slug]            (vercel.json)
     ↓
gate         →  session? access in date? throttled? →  302 to the owner URL
```

**The gate runs server-side, before the owner URL is in any response.** The
browser only ever receives a `302` with a `Location` header, and only once the
session has been checked. `owner_url` lives in Postgres and nowhere else —
`npm test` fails the build if it ever reappears in the HTML.

The client-side `js/unlock.js` picks which panel to show. It is **not** the
paywall and holds no owner URLs.

## Setup

### 1. Supabase

Create the project **in a UK/EU region** — it holds customer emails under a UK
controller and the region can't be changed later.

Run in the SQL editor, in order:

```
db/001_init.sql             schema, RLS, 3-device trigger
db/002_seed_properties.sql  the 84 properties (generated — see below)
```

Then **Authentication → Email**: enable email OTP, and set the template to send
a **6-digit code**, not a magic link. Deliverability matters more than usual
here — if the code doesn't land, someone who has just paid is locked out. Use a
proper sending domain with SPF and DKIM configured, and watch bounces.

### 2. Stripe

- Create the webhook endpoint: `https://<site>/api/stripe-webhook`, event
  `checkout.session.completed`. Copy the signing secret.
- Test mode first. Only swap to live keys after the test plan below passes.

### 3. Vercel environment variables

Copy from `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and can read
`owner_url` — it is server-only and must never be exposed to the browser.

### 4. Regenerating the property data

The seed is generated from the region pages, not hand-written:

```bash
npm run extract      # re-reads the HTML → scripts/properties.json → db/002_*.sql
```

Run this whenever properties are added or removed, then re-run the seed SQL.
Slugs are stable: a title that is unique keeps its clean slug, and collisions
get a short hash of the owner URL, so existing links don't shift when the list
changes.

## Test plan

`npm test` covers the parts that can be checked without credentials — the two
ways this could silently give the product away:

- no owner domain in any `.html` or `js/` file
- all 84 cards point at `/go/<slug>`, and every slug has a property row
- unauthenticated `/go/<slug>` returns a 302 to the unlock panel, with an empty
  body and no owner domain anywhere in the response — checked for all 84 slugs
- gate responses are `no-store` and `noindex`
- `robots.txt` disallows `/go/` and `/api/`

The rest needs real accounts and must be done manually before any live money:

1. Stripe test mode end to end, including a declined card
2. Gate holds in a private window with no session
3. `curl -s https://<site>/united-kingdom.html | grep -o 'href="[^"]*"' | grep http`
   — no owner domains
4. Access expires: set `access_expires_at` to the past, confirm lockout
5. Code arrives and works on a different device and network
6. Fourth device evicts the first
7. Throttle fires under a scripted burst (>25 link opens in 10 minutes)
8. Free pages work fully when unauthenticated
9. One real £5.95 purchase, then refund it

## Decisions worth knowing

**Opaque session cookie, not a Supabase JWT.** Supabase Auth issues and verifies
the 6-digit codes (codes are not hand-rolled). The session itself is a random
token stored as a SHA-256 hash in `sessions`; the cookie is `httpOnly`,
`Secure`, `SameSite=Lax`. This gives clean revocation and makes the 3-device cap
enforceable, which the JWT/refresh model doesn't do neatly. A database leak
doesn't hand over live sessions.

**The webhook grants access, not the redirect.** The success page polls `/api/me`
because webhook delivery can lag a second or two.

**Buying twice extends, rather than resets.** Access is added to whatever remains.

**The 3-device cap is a DB trigger** as well as application code, so it holds
whichever path creates a session.

## Still needed before go-live

- [ ] Stripe account with Gary's bank details
- [ ] Sending domain for the OTP emails (SPF + DKIM)
- [ ] **VAT answer** — if VLA Media Ltd is VAT registered, £5.95 must be
      VAT-inclusive; the price constant is `PRICE_PENCE` in `api/checkout.js`
- [ ] **Solicitor review** of the new refunds section in `terms.html` and the
      account-data section in `privacy-policy.html` — both are drafts
- [ ] Decide the monthly figure: Section 1 of the proposal says £29.99,
      Section 2 still argues £24.99 as a placeholder. They disagree.
