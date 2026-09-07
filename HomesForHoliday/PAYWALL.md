# Directory unlock — £5.95 / 30 days

Browsing stays free and fully indexable; the link through to each owner's own
website is what's paid for.

Access is a signed token in a cookie, and the only way to get one is to prove
you can read the email address that paid. There is no members table and no
sessions table — the single piece of shared state is a pending sign-in code,
which lives for ten minutes and then deletes itself.

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

### The access token

```
payload = base64url({ v:1, e:"buyer@email.com", x:1793827200 })   // e = email, x = expiry
token   = payload + "." + base64url(HMAC_SHA256(payload, ACCESS_SECRET))
```

Verifying is arithmetic: recompute the signature, compare it in constant time,
check the expiry is in the future. No lookup, so the gate does not depend on
Redis, Stripe or anything else being up. Web Crypto rather than `node:crypto`,
so the same helper would still work if the gate ever moved into Edge middleware.

The cookie is `hfh_access` — `HttpOnly`, `Secure`, `SameSite=Lax`, 32 days, so
it outlives the 30-day window by enough for the panel to say "your access ran
out on the 3rd" rather than showing a blank paywall.

### The sign-in code — this is what makes access non-transferable

A token in an emailed link is a bearer credential: forward the email and you
hand over what you paid for, and nothing can revoke it. So nothing we send
grants access. Signing in on a new device means:

1. Enter the email address you paid with → `POST /api/auth/send-code`
2. A six-digit code arrives by email
3. Type it in → `POST /api/auth/verify-code` → cookie set on **this** browser

Redis holds `sha256(ACCESS_SECRET:email:code)` under a key derived from
`sha256(ACCESS_SECRET:key:email)`, for ten minutes. A dump of the store reveals
neither who is signing in nor what their code is. The code is single use, dies
after five wrong guesses, and asking for a new one invalidates the old one.

Codes come from `crypto.randomInt`, which rejects the biased tail rather than
taking a modulus, so all 10⁶ values are equally likely.

### Where the customer record lives

Stripe. It already knows who paid, how much and when, so access is a **fold over
Stripe's own payment history** (`lib/stripe-access.js`): each paid checkout adds
30 days, stacking on whatever was still unused at the time it was made.

That fold is the same function everywhere it matters — `api/activate.js`,
`api/auth/verify-code.js` and `api/stripe-webhook.js` all call it — so signing in
on a phone three weeks later recomputes exactly the same expiry the original
purchase did. No state of ours has to agree with anything.

Losing every email still loses nothing: sign in with the address, and Stripe
says what is left.

## The flow

1. Visitor clicks **Unlock the Directory — £5.95** → `POST /api/checkout`
2. Stripe Checkout (card / Apple Pay / Google Pay), with the consent tick-box
   for immediate access and loss of the 14-day cancellation right
3. Stripe returns to `/api/activate?cs=…` → confirms the payment **with Stripe**,
   folds the expiry, sets the cookie → straight through to the property they
   wanted. No inbox trip on the device they paid on.
4. Signature-verified webhook → `/api/stripe-webhook` → emails the confirmation.
   It contains no link that unlocks anything.
5. Any other device, or after clearing cookies → enter the email → six-digit
   code → cookie

## Files

| File | Purpose |
| --- | --- |
| `lib/token.js` | `sign()` / `verify()` / `peek()`, and the cookie helpers |
| `lib/otp.js` | Issuing and checking the six-digit code; send and attempt limits |
| `lib/redis.js` | Upstash over its REST API. Holds pending codes, nothing else |
| `lib/stripe-access.js` | The fold: paid checkouts → the date access ends |
| `lib/email.js` | The code email and the purchase confirmation, through Resend |
| `lib/throttle.js` | Best-effort burst limit on the gate — in memory, see below |
| `api/_catalogue.js` | **Generated.** slug → owner URL. Inside `api/` so it is function source, not static output |
| `api/go/[slug].js` | The gate |
| `api/checkout.js` | Creates the Stripe Checkout Session |
| `api/activate.js` | Back from Stripe → confirms payment → cookie → instant access |
| `api/stripe-webhook.js` | Verifies the signature → emails the confirmation |
| `api/auth/send-code.js` | Emails a six-digit code |
| `api/auth/verify-code.js` | Checks the code, then asks Stripe what it is worth |
| `api/me.js` | Cookie state for the unlock panel. No lookups |
| `api/signout.js` | Clears the cookie on this device |

## Setup

### 1. Environment variables

Copy from `.env.example` into Vercel → Settings → Environment Variables.

```bash
npm run secret     # generates an ACCESS_SECRET
```

Rotating `ACCESS_SECRET` invalidates every live token **and** every code in
flight, so only do it if the secret leaks.

### 2. Stripe

- Webhook endpoint `https://<site>/api/stripe-webhook`, event
  `checkout.session.completed`. Copy the signing secret.
- **Test mode first**, using test keys. Going live for Gary is a config change,
  not a code change: swap `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` for
  his account's live values and create the webhook endpoint again in his
  dashboard. Nothing else moves.

### 3. Upstash

Database `hfh-prod-otp`, London (`eu-west-2`), pay as you go. Copy the **REST**
credentials — `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — not the
`redis://` connection string. Worth setting a max budget on the database; it is
"Not set" by default.

Deliberately a separate database from the MockupGen stores: one leaked token
should not reach two projects.

### 4. Resend

Verify a sending domain and configure **SPF and DKIM**. This matters more than
usual: the code email is the only way onto a second device, so a code that lands
in spam is a paying customer locked out.

### 5. Regenerating the catalogue

```bash
npm run catalogue    # from properties.csv — validates first, refuses on errors
npm run links        # from scripts/properties.json — used while the CSV has errors outstanding
```

Run one of these whenever properties change, then deploy. Slugs are stable, so
existing links don't shift when the list grows.

## Test plan

`npm test` covers everything that can be checked without credentials — 47
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
- codes are single use, die after five wrong guesses, do not work for a
  different address, and cannot be read back out of the store
- **no forwardable credential exists**: the magic-link endpoints are gone, no
  email builds a link that unlocks anything, and the panel signs in with a code
- the Stripe fold stacks a repeat purchase, starts fresh after a lapse, and does
  not depend on the order Stripe lists payments in

The rest needs real accounts and must be done before any live money:

1. Stripe **test mode** end to end, including a declined card
2. Gate holds in a private window with no cookie
3. `curl -s https://<site>/united-kingdom.html | grep -o 'href="[^"]*"' | grep http`
   — no owner domains
4. **Confirm `/scripts/properties.json` and `/properties.csv` 404 on the
   deployed site.** `.vercelignore` should keep them out of the upload
   entirely; verify it rather than assume it
5. Access expires: mint a token with a one-minute expiry, confirm lockout
6. The code email arrives on a different device and network, and signing in
   there works
7. Signing in again does **not** extend the window
8. Free pages work fully with no cookie
9. One real £5.95 purchase on Gary's live keys, then refund it

## Decisions worth knowing

**Owner URLs in `api/`, not in a data file.** Vercel serves the project root as
static output, so a `data/properties.json` would have been a public URL — the
whole product, free. Files under `api/` are function source. `.vercelignore` and
a `npm test` check both back this up.

**Nothing emailed grants access.** The confirmation and the code email both go
out over Resend, and neither carries a credential that works on its own. This is
the difference between "sharing is discouraged" and "sharing does not work", and
it is the claim made to Gary in the proposal.

**The gate never touches Redis or Stripe.** Only signing in does. If Upstash is
unreachable, existing customers browse unaffected and only new sign-ins fail;
`/api/auth/verify-code` returns 503 and says so rather than pretending the code
was wrong.

**Stripe is the customer record.** No table of members, and no "we deleted your
account" problem — there is nothing to delete.

## What this design gives up

- **No device cap.** A buyer can sign in on as many of their own devices as they
  like. Capping needs shared session state; there isn't any.
- **A determined buyer can still relay codes.** Someone willing to read out a
  fresh code every ten minutes, forever, can let one other person in. That is a
  different problem from a link on a forum, and not worth engineering against at
  £5.95.
- **The gate's burst limit is best-effort.** `lib/throttle.js` lives in the
  memory of one warm function instance, so it resets on a cold start and doesn't
  see requests handled elsewhere. It costs a scraper something and a real
  visitor nothing. Moving it into Redis is now a small change, if scraping ever
  looks real.
- **No click analytics.** Nothing records which properties get opened, so
  "which regions are people actually looking at" can't be answered from here.
- **No auto-renew.** Month two means buying again — which is the repeat-purchase
  model Gary wants, but it is not recurring revenue.

## Still needed before go-live

- [ ] Stripe account with Gary's bank details (test mode until then)
- [ ] Resend account and a verified sending domain (SPF + DKIM)
- [ ] `ACCESS_SECRET` generated and set in Vercel
- [ ] `UPSTASH_REDIS_REST_TOKEN` set in Vercel
- [x] **VAT** — VLA Media Ltd is not VAT registered, so £5.95 is the whole
      price and none of it is VAT. Stated in `terms.html` and at `PRICE_PENCE`
      in `api/checkout.js`. Revisit only if the company registers: the price
      would then have to be VAT-inclusive at £5.95 rather than £5.95 plus VAT,
      which cuts the net take.
- [ ] **Gary to read** the refunds and personal-use sections in `terms.html`,
      and the directory-access section in `privacy-policy.html`. His call
      whether to put them past a solicitor; they are drafts either way. The
      privacy one now names Upstash as a processor and describes the ten-minute
      code record, so it needs a fresh read rather than a glance.
