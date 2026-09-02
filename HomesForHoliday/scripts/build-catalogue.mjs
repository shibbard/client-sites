// Builds properties.csv — the working catalogue Gary fills in.
//
// Why this exists: before the paywall, the region-page HTML held the owner URLs,
// so the data could always be re-read from it. It no longer does (that is the
// point), which means the HTML can't be the source of truth any more. This
// pulls the card fields out of the HTML one last time, joins the owner URLs
// from the migration output, and writes a spreadsheet that becomes the source
// of truth from here on. scripts/from-csv.mjs reads it back.
import { readFileSync, writeFileSync } from 'node:fs';

const REGIONS = {
  'united-kingdom.html': 'United Kingdom',
  'europe.html': 'Europe',
  'usa.html': 'USA',
  'caribbean-islands.html': 'Caribbean Islands',
  'central-america.html': 'Central America',
};

const ownerBySlug = Object.fromEntries(
  JSON.parse(readFileSync('scripts/properties.json', 'utf8')).map(r => [r.slug, r.owner_url])
);

const CARD = /<a class="prop-card reveal" href="\/go\/([^"]+)"[\s\S]*?<div class="prop-media">([\s\S]*?)<\/div>\s*<div class="prop-body">\s*<span class="prop-sub">([^<]*)<\/span>\s*<h3>([\s\S]*?)<\/h3>\s*<p class="prop-type">([\s\S]*?)<\/p>([\s\S]*?)<\/a>/g;

const decode = s => s
  .replace(/&amp;/g, '&').replace(/&rsquo;/g, '’').replace(/&eacute;/g, 'é')
  .replace(/&egrave;/g, 'è').replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ')
  .replace(/&mdash;/g, '—').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/<[^>]+>/g, '').trim();

const rows = [];
for (const [file, region] of Object.entries(REGIONS)) {
  const html = readFileSync(file, 'utf8');
  let m;
  while ((m = CARD.exec(html)) !== null) {
    const [, slug, media, sub, title, type, tail] = m;
    const img = (media.match(/<img src="([^"]*)"/) || [])[1] || '';
    const pool = (media.match(/class="prop-pool"[^>]*>(?:<[^>]+>)*([^<]*)</) || [])[1] || '';
    const beds = (tail.match(/([\d.]+)\s*Beds?/i) || [])[1] || '';
    const baths = (tail.match(/([\d.]+)\s*Baths?/i) || [])[1] || '';
    rows.push({
      slug,
      region,
      sub: decode(sub),
      title: decode(title),
      type: decode(type),
      beds,
      baths,
      pool: pool.trim(),
      image: img,
      owner_url: ownerBySlug[slug] || '',
      status: 'live',
      notes: '',
    });
  }
}

const COLUMNS = ['slug', 'region', 'sub', 'title', 'type', 'beds', 'baths',
                 'pool', 'image', 'owner_url', 'status', 'notes'];

const cell = v => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csv = [COLUMNS.join(',')]
  .concat(rows.map(r => COLUMNS.map(c => cell(r[c])).join(',')))
  .join('\r\n');

// BOM so Excel opens the accented place names correctly.
writeFileSync('properties.csv', '﻿' + csv + '\r\n');
console.error(`properties.csv — ${rows.length} rows`);

const missing = rows.filter(r => !r.owner_url);
if (missing.length) console.error(`WARNING: ${missing.length} rows have no owner_url`);
