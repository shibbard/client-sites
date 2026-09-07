# Adding and organising properties

Answers Gary's questions of 2 September, and sets up the workflow for growing
the directory.

## "Is the link all you need?"

Nearly, yes — more than I first thought. The photos can be pulled off the
owner's own site automatically (see below), so in practice **the link plus a
couple of details is enough**. Here is what a card needs:

| Column | Example | Notes |
|---|---|---|
| `owner_url` | `https://vellandreathcornishcottages.com/` | the link |
| `title` | `Sennen, Cornwall` | **place**, not the property's trading name |
| `sub` | `South West England` | the sub-heading it gets grouped under |
| `region` | `United Kingdom` | which of the five pages it lands on |
| `type` | `Cottage` | Cottage, Villa, Apartment, Barn Conversion, Cabin, House, Mansion… |
| `beds` / `baths` | `3` / `2` | numbers |
| `pool` | `Private Pool` | optional — or `Communal Pool`, or blank |
| `image` | `images/xxx.webp` | grabbed from the owner site by the script below |

House style is no external image links, so photos have to be downloaded,
converted to `.webp` and put in `images/`. That part is now scripted.

**Short version for Gary: the link is enough to start.** Beds and baths are
worth confirming, and the property type and sub-region need a human, but no
photo needs sending.

### Grabbing the photos from a link

```bash
node scripts/fetch-property.mjs <owner-url>              # see what it found
node scripts/fetch-property.mjs <owner-url> --pick 1 --slug sennen-cornwall
```

It reads the owner's page, lists every usable photo with its size, then
converts the chosen one to the same 720x540 `.webp` every existing card uses,
and prints a spreadsheet row.

Photos on these sites are usually **not** in `<img>` tags — they tend to be CSS
backgrounds or `data-bg` slideshow attributes, so all of those are harvested
too. On Gary's example, `vellandreathcornishcottages.com`, it found 14 usable
hero shots at 1240x827 plus the page title, description and a bed count, from
nothing but the link.

> The photos belong to the owner. They are fine to use for the listing that
> promotes them, but that rests on Gary's relationship with each owner, not on
> the fact that the file was reachable.

## The spreadsheet

`properties.csv` is now the master list — all 84 current properties, one row
each. Open it in Excel. It is the single source of truth: the website and the
database are both generated from it.

To add properties, add rows. To retire one, set `status` to `hidden` rather
than deleting the row, so there's a record of it.

Then:

```bash
npm run catalogue          # checks the sheet, then regenerates everything
```

That does three things:

1. **Checks the list** for duplicates, wrong regions and missing photos
2. Rewrites `api/_catalogue.js` — the slug-to-owner-URL map the paywall reads.
   It lives inside `api/` on purpose: files there are function source, not
   static output, so it is never fetchable from the site
3. Writes `build/cards/<region>.html` — card markup to paste into the region page

`npm run catalogue:verify` confirms the generated markup still matches what's on
the site, so pasting can't silently restyle existing cards.

> Leave `slug` blank on new rows and one gets generated. Slugs are the public
> `/go/<slug>` address, so once a property is live its slug shouldn't change.
> They deliberately avoid containing the owner's domain — a guessable slug would
> hand over the thing being sold.

## "How do we make sure we're not replicating properties?"

The check is automatic now, and it runs on the owner's website address rather
than the name, because the same property is often written up differently
("Disney, Orlando" vs "Orlando Villa"). Two rows pointing at the same website
is reported as an error and blocks generation until it's resolved.

**It has already found one.** Two USA cards both point at
`oristaendlesssummervilla.com` — identical title, type, beds and baths, with
only the photo differing:

```
disney-orlando-579556   images/image-standard-prv-845935.webp
disney-orlando-bfb4af   images/image-standard-prv-845930.webp
```

Almost certainly the same villa entered twice with different photos. **Gary
needs to confirm** — if it is a duplicate, set one row's `status` to `hidden`.
I haven't done it, because if they are genuinely two separate units let by the
same owner, they should both stay and just need distinct titles.

The check also warns when the same place name appears repeatedly in one region.
Twelve of the USA entries are "Disney, Orlando", which is plausible — it's a
villa cluster — but it does mean guests see twelve identical-looking headings.
Worth giving them distinguishing names at some point.

## "Some properties are in the wrong regions"

Gary is right. The checker flags these:

| Property | Currently | Should probably be |
|---|---|---|
| Maya Beach (Belize) | Caribbean Islands | **Central America** — Belize is mainland Central America |
| Palmetto Bay (Roatán) | Caribbean Islands | **Central America** — Roatán is part of Honduras |
| Turks & Caicos | sub-region is just "Caribbean" | give it a real sub-region |

Both misfiled ones are genuinely Caribbean *coastline*, which is how they ended
up there — so it's a judgement call, not a clear error. Moving them would take
Caribbean Islands from 6 to 4 and Central America from 4 to 6.

There's also inconsistent grouping, which is worth settling before adding more:

- **UK** mixes counties with broad regions — "Hampshire" and "Yorkshire" sit
  alongside "South East England" and "Northern England"; "Wales" alongside
  "North Wales"; "Southern England" alongside "South West England"
- **Europe** mixes countries with areas — "Spain" alongside "Costa Blanca,
  Spain" and "Costa del Sol, Spain"; "France" alongside "French Riviera, France"

Pick one level per region and the pages group themselves cleanly. Doing it now,
at 84 properties, is much easier than at 150.

## Current spread

```
 32  United Kingdom      (19 of the 28 USA entries are Florida)
 14  Europe
 28  USA
  6  Caribbean Islands
  4  Central America
```

Gary's plan of 5–10 more per region would take it to roughly 110–135. The thin
areas are Caribbean Islands, Central America and Europe; the USA is heavily
concentrated on Orlando.

## There is no database

By design. The paywall holds no customer records: access is a signed token in a
cookie, and `api/_catalogue.js` — generated from this spreadsheet — is the only
server-side data there is. The one thing that is stored is a pending sign-in
code, which deletes itself after ten minutes. Adding a property means
regenerating that file and deploying; there is nothing to migrate.

What is not provisioned yet is **Stripe** and **Resend**, so nothing can take
money or send a sign-in code until those accounts exist. The site itself works
exactly as it does today.

## One thing that needs deciding

The `.region-group-head` blocks on each page carry a hand-written count
("13 homes") and a short description. Those are **not** generated, so they go
stale as properties are added. Either they get updated by hand each time, or
the count gets generated too — worth deciding before the first batch goes in.

## "New properties every month" — encouraging repeat purchases

Worth noting the mechanics already support this: access lapses after 30 days
with no auto-renew, and buying again extends rather than resets. What isn't
built yet is anything that *tells* people there's new stock — a "recently
added" marker on cards, or a date-added column driving a "new this month"
section. Both are straightforward once the spreadsheet has an `added` date.
Not built, since it wasn't in the signed-off spec.
