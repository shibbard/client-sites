# ClientSites — Claude Context

## What this repo is

Static HTML/CSS/JS client websites built and maintained by Get Digital Done (Ceers 2112 Ltd). Each client gets a subdirectory. All sites are deployed to Vercel and served via branded subdomains on `getdigitaldone.co.uk`.

---

## Repo structure

18 client sites, one folder each. A site is either still on its build-time preview subdomain of `getdigitaldone.co.uk`, or has been pointed at the client's own domain once they went live. The canonical tag in a site's `index.html` is the reliable indicator of which.

**Live on the client's own domain**

```
EverybodysBeautiful/       → www.ebstonehouse.com
IanRiceBuilding/           → www.ianricebuilding.com
JK/                        → www.jennieskitchen.co.uk        (JK = Jennie's Kitchen)
JaxElectricalServices/     → www.jaxelectricalservices.co.uk
RandBElectrical/           → randb-electrical.co.uk
SRGCatering/               → srgcatering.co.uk
TMR/                       → www.tmres.co.uk                 (TMR Electrical Services)
VehicleLeasingAssociates/  → www.vlauk.com                   (VLA Media Ltd)
```

**Still on a preview subdomain**

```
AspectRep/                 → aspectrep.getdigitaldone.co.uk
DeltaNineIT/               → delta-nine-it.getdigitaldone.co.uk
DeltaRoofingRepairs/       → deltaroofingrepairs.getdigitaldone.co.uk
HomesForHoliday/           → home-for-holiday.getdigitaldone.co.uk
McDonnellPrice/            → mcdonnell-price.getdigitaldone.co.uk
```

**No canonical set — check before assuming a domain**

```
LaCampagna/  StonehouseMill/  TheWoolpack/  WhaddonGarage/  WoodcockLane/
```

Each folder contains a self-contained static site: `index.html`, `css/style.css`, `js/`, `images/`, `favicon.svg`, `favicon.png`, `vercel.json`, `robots.txt`, `sitemap.xml`. Multi-page sites are the norm rather than the exception — several run to 9–19 HTML pages, so when making a site-wide change (a footer, a nav item, a legal line), change every page in the folder, not just `index.html`.

When a client goes live, the preview subdomain is redirected to the real domain with a host-matched redirect in `vercel.json` — see `VehicleLeasingAssociates/vercel.json` for the pattern. This means the preview URL stops being useful for checking that site: it 301s to the live domain.

---

## Vercel setup

- **Account:** Simon Hibbard (`shibbard`) — team: `simons-projects-5313062d`
- **Auth token location:** `C:\Users\Simon\AppData\Roaming\com.vercel.cli\Data\auth.json`
- **Deployment:** normally **manual, via the Vercel CLI** — not driven by git. Each subfolder is a separate Vercel project.
- **Domains:** Subdomains of `getdigitaldone.co.uk` — DNS is a wildcard CNAME `*.getdigitaldone.co.uk → cname.vercel-dns.com` (needs to be set at the registrar if not already done).

**Pushing to `main` does not publish anything.** Committing and pushing only moves code in git; the site changes when someone runs the CLI deploy. Never report work as live, published or deployed on the strength of a push alone. There is also a per-repo cap on how many Vercel projects can be connected to GitHub, which is part of why deploys are manual.

### Per-project Vercel settings
Each project has `rootDirectory` set to its folder name (e.g. `JK`) and an `ignoreCommand` in `vercel.json` intended to deploy only when that folder's files change:

```json
{
  "ignoreCommand": "if git diff HEAD~1 --name-only | grep -q '^FOLDERNAME/'; then exit 1; else exit 0; fi"
}
```

**Important:** `exit 1` = deploy, `exit 0` = skip. The old `grep -qv` pattern was wrong (inverted) and caused deployments to cancel on multi-site commits — fixed April 2026, but **only for about half the repo**. As of August 2026 these nine still carry the inverted form: `AspectRep`, `HomesForHoliday`, `McDonnellPrice`, `RandBElectrical`, `SRGCatering`, `TheWoolpack`, `VehicleLeasingAssociates`, `WhaddonGarage`, `WoodcockLane`.

This only bites on git-connected projects — an `ignoreCommand` never runs for a manual CLI deploy. Fix one when you touch that client's `vercel.json` for another reason, or if that project gets connected to git.

### Vercel CLI commands
```bash
# List recent deployments
npx vercel ls

# Check a specific project
npx vercel ls jennies-kitchen

# Deploy a site to production (the usual workflow)
git pull origin main
cd VehicleLeasingAssociates
vercel --prod

# For a git-connected project, rootDirectory is set in Vercel cloud, so deploying
# from the subfolder can confuse path resolution — run from the repo root instead.
```

### Deploying from a Claude Code cloud session

Cloud sessions run on Anthropic infrastructure, not Simon's machine, so the local `auth.json` above is unavailable and outbound network is restricted. Deploying from a cloud session needs both of these on the environment (the cloud icon above the message box at claude.ai/code — there is no settings page for it):

- `VERCEL_TOKEN` as an environment variable
- Network access set to `Full`, or `Custom` including `api.vercel.com` plus any domain you need to verify

Without those, a cloud session can commit and push but **cannot deploy** — say so plainly rather than implying the change is live. Environment changes only apply to newly started sessions.

---

## GitHub

- **Repo:** `https://github.com/shibbard/client-sites`
- **Branch:** `main` — all work goes here. Note `main` is *not* the repo's GitHub default branch setting, which still points at `master`; a fresh shallow clone therefore lands on the wrong branch. Always `git checkout main` (or clone and then switch) before doing anything.
- There is also a stale `master` branch with an older four-folder structure (JK, TMR, GetDigitalDone) — ignore it. It is hundreds of commits behind and does not contain most clients.
- Keep each commit scoped to a single client folder, so deploy history and rollbacks stay per-client.

---

## Site conventions

- Dark/light themes per client — no shared design system
- Fonts loaded from Google Fonts
- No build step, no framework — pure static files
- Images stored in `images/` subdirectory; gallery images in `images/gallery/`
- Favicons: `favicon.svg` (initials on brand colour) + `favicon.png` (real logo if available)
- Contact forms: usually Formspree
- No external CDN image references — all images must be local
- Copy is British English (`en_GB`) throughout: "specialise", "colour", "centre", UK phone and address formatting
- `robots.txt` explicitly allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, anthropic-ai, Applebot, Amazonbot, cohere-ai) alongside search bots, and ends with a `Sitemap:` line
- `<head>` order: primary SEO (title, description, keywords, robots, canonical) → Open Graph → Twitter card → JSON-LD, each under a banner comment. Use the most specific schema.org type that fits the business (`CafeOrCoffeeShop`, `Electrician`, `Dentist`…) with an `@id` of `https://<domain>/#business`

### Keep `llms.txt` in step with the site

Most sites carry an `llms.txt` describing the business for AI crawlers. It is hand-written and nothing validates it, so it drifts silently — and because AI assistants read it to answer questions about the client, a stale file puts wrong information in front of real customers.

**When site content changes, update `llms.txt` in the same commit.** In August 2026 VLA's had drifted badly: it listed a vehicle that was no longer on the site, omitted two that were, and quoted deal reference codes that did not exist anywhere — so anyone acting on an AI answer would have quoted a made-up reference to the client. Prices, product/deal listings, page paths and service claims are the parts that rot fastest.

Every claim in `llms.txt` should be traceable to something actually on the site. If it is not on the page, it does not go in the file.

---

## Client notes

| Folder | Client | Sector / location | Notes |
|---|---|---|---|
| `AspectRep` | Aspect Real Estate Partners | Commercial property, Orange County | Largest site (12 pages). Only non-UK client — US English and US formatting here, not `en_GB`. |
| `DeltaNineIT` | Delta Nine IT | Computer repair, Stonehouse | No `js/`. |
| `DeltaRoofingRepairs` | Delta Roofing Repairs Ltd | Roofing, Greater Manchester | Single-page site. |
| `EverybodysBeautiful` | Everybody's Beautiful | Beauty salon, Stonehouse | Biggest page count (19). |
| `HomesForHoliday` | Home for Holiday | Holiday lettings directory | Has `DESIGN.md` and `PRODUCT.md` — read those first. Carries a full legal set: `disclaimer.html`, `terms.html`, `privacy-policy.html`. |
| `IanRiceBuilding` | Ian Rice Building Ltd | Builder, Stroud | Hero image rotation. Portfolio lightbox. |
| `JK` | Jennie's Kitchen | Café, Ashton Keynes | Gallery in `images/gallery/`. Lightbox April 2026. No `llms.txt` or `js/`. |
| `JaxElectricalServices` | JAX Electrical Services Ltd | Electrician, Gloucestershire | |
| `LaCampagna` | La Campagna | Italian brasserie | No canonical set. |
| `McDonnellPrice` | McDonnell-Price Roofing Contractors Ltd | Roofing, Gloucestershire & South West | |
| `RandBElectrical` | R & B Electrical Installations | Electrician, Stroud | |
| `SRGCatering` | SRG Catering | Event catering, Gloucestershire | Single-page site. No `js/`. |
| `StonehouseMill` | Stonehouse Mill | Paper bags & packaging, Stonehouse | No canonical set. |
| `TMR` | TMR Electrical Services Ltd | NICEIC electrician, Stroud | No `js/`. |
| `TheWoolpack` | The Woolpack | Pub & restaurant, Slad | No canonical set. |
| `VehicleLeasingAssociates` | VLA Media Ltd T/A Vehicle Leasing Associates | Vehicle leasing introducer, Exeter | See the regulated-sector note below — this site has compliance constraints the others don't. |
| `WhaddonGarage` | Whaddon Garage | MOT & servicing, Gloucester | No canonical set. |
| `WoodcockLane` | Woodcock Lane Dental Care | Dentist, Stonehouse | No canonical set. |

---

## Legal and compliance

Client sites carry a footer legal line naming the operating company and its Companies House number.

**`VehicleLeasingAssociates` has stricter requirements than the rest.** VLA Media Ltd (Co. No. 17030518) is an introducer that is *not* FCA authorised, so its disclaimer is split across three tiers:

1. **`disclaimer.html`** — the client's full approved text, verbatim. Do not reword it; it was drafted for approval and the exact wording matters.
2. **Footer block on every page** — condensed, but always keeping the two statements that must be visible without a click: not FCA authorised / not a broker, and the commission disclosure.
3. **Next to every price** — the lease-price note on `index.html` and `lease-examples.html`, and above the submit button on the quote form. A disclaimer behind a link does not neutralise a price shown next to a call to action; the test is what a customer sees at the moment of the promotion.

When editing VLA, avoid "broker", "finance", "apply" or "approved" in CTAs — body copy that contradicts the disclaimer is worse than no disclaimer. "Enquire" and "Get in touch" are safe.

Apply the same three-tier pattern to any future client in a regulated or regulated-adjacent sector.

---

## GetDigitalDone main site

Separate repo: `https://github.com/shibbard/getdigitaldone`
Local path: `C:\Dev\WebsiteMaker\GetDigitalDone\`
Live: `https://www.getdigitaldone.co.uk`
Company: Ceers 2112 Ltd, Co. No. 16512807
Contact: hello@getdigitaldone.co.uk | 07405 470663 | WhatsApp: wa.me/447405470663
