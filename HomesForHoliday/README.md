# Home for Holiday

A curated directory of holiday homes, each linking straight through to the
owner's own website. No booking fees, no agency in the middle. Browsing is free;
the link through to an owner is paid — £5.95 for 30 days.

**Client:** Gary, VLA Media Ltd (South Town Lodge, South Town, Exeter, Devon
EX6 8JE · company no. 17030518) · hfh.travel@outlook.com · +44 7352 816278
**Built and hosted by:** GetDigitalDone

Start here, then follow the doc that covers what you are actually doing:

| Doc | Covers |
| --- | --- |
| [PAYWALL.md](PAYWALL.md) | How the £5.95 unlock works end to end. Read this before touching `api/` or `lib/` |
| [ADDING-PROPERTIES.md](ADDING-PROPERTIES.md) | Adding properties, the spreadsheet, regenerating the catalogue |
| [DESIGN.md](DESIGN.md) | Colours, type, layout, components |
| [PRODUCT.md](PRODUCT.md) | Who the site is for and what it promises |

## The stack, and why it is this small

Static HTML, hand-written CSS and vanilla JS, with a handful of Vercel
serverless functions for the paid parts. No framework, no build step, one npm
dependency (`stripe`). Node 20+.

That is deliberate. It is a brochure site with a paywall bolted to one narrow
seam, on a £29.99/month management fee. A framework would add a build to break,
a dependency tree to patch, and nothing the site needs. Pages are edited
directly; `scripts/` regenerates the property cards from a spreadsheet.

```
*.html            15 pages, edited directly. Region pages hold the property cards
css/style.css     the whole stylesheet
js/main.js        nav, scroll behaviour, header access state
js/unlock.js      the unlock panel state machine (presentation only)
api/              Vercel serverless functions — the paywall lives here
lib/              server-side helpers used by api/
scripts/          local tooling: spreadsheet → catalogue. Never deployed
images/           property photos and brand assets
```

84 properties. The public region pages are indexable by design — that is where
the search traffic comes from — and only the click through to an owner is gated.

## Commands

```bash
npm test                 # 52 checks. Run before every deploy — it is what stops
                         # an owner URL leaking into a deployed file
npm run catalogue        # rebuild api/_catalogue.js from properties.csv
npm run links            # rebuild it from scripts/properties.json instead
npm run secret           # generate an ACCESS_SECRET
node scripts/dev-server.mjs   # static preview on :8787 with STUBBED api responses
npx vercel dev           # the real functions, locally (needs .env.local)
```

`scripts/dev-server.mjs` fakes every API response — good for looking at panels,
useless for testing the paywall. `STUB_STATE=locked|active|lapsed` picks which
state to render.

## Hosting and deployment

Vercel project **home-for-holiday** under the **simons-projects-5313062d** (Hobby)
account. Production domain **home-for-holiday.getdigitaldone.co.uk**.

**Deploys are run from the CLI, not from git.** Pushing to GitHub does not
deploy anything — there is no working Git integration on this project. To ship:

```bash
cd HomesForHoliday
npm test
npx vercel deploy            # preview
npx vercel deploy --prod     # production
```

This is worth fixing before handover: right now shipping depends on whoever has
the CLI authenticated locally.

Source lives in **shibbard/client-sites**, one repo for all GetDigitalDone client
sites, with this site under `HomesForHoliday/`. `vercel.json` carries an
`ignoreCommand` so a build is skipped unless the last commit touched this folder.

### The test preview

A long-lived preview used for paywall testing:

| | |
| --- | --- |
| URL | https://hfh-paywall-test.vercel.app |
| Points at | whichever deployment was last aliased to it |
| Repoint | `npx vercel alias set <deployment-url> hfh-paywall-test.vercel.app` |

It has a stable hostname because the Stripe webhook and the access cookies are
both tied to the host — a fresh random preview URL breaks both. **Vercel
Deployment Protection is currently disabled** so Stripe can reach the webhook
and a phone can open it without a Vercel login. Turn it back on when testing
finishes, or the preview stays publicly reachable.

Note that cookies are per-hostname: signing in on one preview URL does not sign
you in on another.

## External services

Nothing here is a secret — the secrets live only in Vercel's environment
variables and in the providers' own dashboards.

| Service | What it does | Identifiers |
| --- | --- | --- |
| **Stripe** | Takes the payment, and *is* the customer record — access is recomputed from payment history rather than stored | Currently the **GetDigitalDone sandbox**, `acct_1TJWzbA1fWLsF0Ax`. Test webhook `we_1UDTEGA1fWLsF0Ax1H5qDzoj` → `/api/stripe-webhook`, event `checkout.session.completed` only |
| **Upstash Redis** | Holds pending six-digit sign-in codes for ten minutes. Nothing else, ever | Database `hfh-prod-otp`, London `eu-west-2`, pay-as-you-go. REST endpoint `https://obliging-tuna-98582.upstash.io`. Separate from the MockupGen databases on purpose |
| **Resend** | Sends the sign-in code and the purchase confirmation | Sending domain still unverified — currently `onboarding@resend.dev`, which only delivers to the account owner |
| **Vercel** | Hosting and the serverless functions | Project `prj_gY66mQ7UAWgLF9ZKM9IhZDmXEPVy` |

### Environment variables

Seven, all set on **Preview** only at present. See `.env.example` for what each
one is. Production has none, because the paywall has never been deployed to the
live site.

```
ACCESS_SECRET             signs access tokens and keys the stored codes
STRIPE_SECRET_KEY         sk_test_… for now
STRIPE_WEBHOOK_SECRET     whsec_… from the webhook endpoint, not the dashboard
UPSTASH_REDIS_REST_URL    REST endpoint, not the redis:// string
UPSTASH_REDIS_REST_TOKEN
RESEND_API_KEY
MAIL_FROM
SITE_URL                  deliberately UNSET on Preview, so Stripe returns to
                          whichever preview host is being used
```

## State of play

The paywall is **built and tested end to end on the preview**, and **not
deployed to production**. The live site is still the plain directory: it has no
`/unlock.html` and no `/go/` routes.

Verified on a real deployment: purchase → instant access → gate → six-digit
sign-in on a fresh host → repeat purchases stacking (three test payments folded
to 90 days, not 30) → webhook-driven confirmation email.

### Going live for Gary

The code does not change. What changes is whose accounts it points at:

1. Stripe account in **Gary's** name with his bank details; swap
   `STRIPE_SECRET_KEY` for `sk_live_…`
2. Create the webhook again in **his** dashboard against the production domain;
   put that `whsec_` in Production
3. Resend sending domain verified with **SPF and DKIM** — a sign-in code in the
   spam folder is a paying customer locked out
4. `ACCESS_SECRET`, Upstash credentials and `MAIL_FROM` set on Production
5. `SITE_URL` set to the production origin
6. Work through the manual test plan at the end of [PAYWALL.md](PAYWALL.md),
   including confirming `/properties.csv` 404s on the deployed site
7. Gary to read the refunds and personal-use sections of `terms.html` and the
   directory-access section of `privacy-policy.html`

VLA Media Ltd is **not VAT registered**, so £5.95 carries no VAT. If that ever
changes, the price must become VAT-inclusive at £5.95 rather than £5.95 plus
VAT — the constant is `PRICE_PENCE` in `api/checkout.js`.

### Known and deliberate

- **Property details are public.** Town, county, type and bed count are visible
  without paying; only the owner's link is gated. That is what makes the pages
  rank, and it is a live question with Gary rather than an oversight
- **`lib/` is uploaded as static output** and kept unreachable by a redirect in
  `vercel.json` rather than by `.vercelignore` — the functions need those files
  present. No secrets are in them. Moving them to `api/_lib/` would close it
  properly
- **No device cap and no revocation.** Both need shared state; there is none.
  See "What this design gives up" in [PAYWALL.md](PAYWALL.md)
- **`payment_method_types: ['card']`** in `api/checkout.js` pins the payment
  methods and stops the Stripe dashboard offering wallets. Removing it would let
  Apple Pay and Google Pay appear, which the proposal promises Gary
