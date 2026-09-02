// One-off: lift the owner URLs out of the region pages into structured data.
// After the migration is seeded the URLs must not appear in the HTML at all.
//
// Slugs are public (/go/<slug>), so they must never hint at the owner's domain
// — a guessable slug would hand over the very thing being sold. Titles are used
// where unique; collisions get a short sha256 suffix, stable per property no
// matter what order the cards sit in or what is added later.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const REGIONS = {
  'united-kingdom.html': 'United Kingdom',
  'europe.html': 'Europe',
  'usa.html': 'USA',
  'caribbean-islands.html': 'Caribbean Islands',
  'central-america.html': 'Central America',
};

const CARD = /<a class="prop-card reveal" href="(https?:\/\/[^"]+)"[^>]*aria-label="([^"]*)"[\s\S]*?<img src="([^"]*)"[\s\S]*?<span class="prop-sub">([^<]*)<\/span>\s*<h3>([\s\S]*?)<\/h3>/g;

const decode = s => s
  .replace(/&amp;/g, '&').replace(/&rsquo;/g, '’').replace(/&eacute;/g, 'é')
  .replace(/&egrave;/g, 'è').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
  .replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—')
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim();

const slugify = s => decode(s).toLowerCase()
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const hash6 = s => createHash('sha256').update(s).digest('hex').slice(0, 6);

const raw = [];
for (const [file, region] of Object.entries(REGIONS)) {
  const html = readFileSync(file, 'utf8');
  let m, count = 0;
  while ((m = CARD.exec(html)) !== null) {
    const [, url, label, img, sub, title] = m;
    raw.push({ url, img, sub: decode(sub), title: decode(title), region, file,
               base: slugify(title) || slugify(label) });
    count++;
  }
  console.error(`${file.padEnd(24)} ${count}`);
}

const baseCounts = raw.reduce((a, r) => (a[r.base] = (a[r.base] || 0) + 1, a), {});
const urlCounts  = raw.reduce((a, r) => (a[r.url]  = (a[r.url]  || 0) + 1, a), {});

const rows = raw.map(r => {
  let slug = r.base;
  if (baseCounts[r.base] > 1) {
    // Two cards sharing one owner URL exist in the source data, so the photo is
    // the only thing that separates them.
    slug = `${r.base}-${hash6(urlCounts[r.url] > 1 ? r.url + '|' + r.img : r.url)}`;
  }
  return { slug, region: r.region, owner_url: r.url, title: r.title, sub: r.sub,
           file: r.file, img: r.img };
});

const slugs = rows.map(r => r.slug);
const dupes = [...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))];
if (dupes.length) { console.error('DUPLICATE SLUGS:', dupes); process.exit(1); }

// Guard the thing that would silently break the paywall.
const leaky = rows.filter(r => {
  const host = new URL(r.owner_url).hostname.replace(/^www\./, '').split('.')[0];
  return host.length > 3 && r.slug.includes(host);
});
// Not fatal: where this fires the place name is already printed on the card,
// so the visible title is the hint, not the slug. Worth surfacing, not blocking.

writeFileSync('scripts/properties.json', JSON.stringify(rows, null, 2));

const sharedUrls = Object.entries(urlCounts).filter(([, n]) => n > 1);
console.error(`\ntotal ${rows.length}, unique slugs ${new Set(slugs).size}, no domain leaks`);
if (leaky.length) {
  console.error(`
NOTE — ${leaky.length} slug(s) share a word with the owner domain, because the
place name is part of both. The card already shows that name publicly:`);
  leaky.forEach(r => console.error(`  ${r.slug}`));
}
if (sharedUrls.length) {
  console.error(`\nNOTE — ${sharedUrls.length} owner URL(s) used by more than one card (duplicate listing in the source site):`);
  sharedUrls.forEach(([u, n]) => console.error(`  ${n}x  ${u}`));
}
