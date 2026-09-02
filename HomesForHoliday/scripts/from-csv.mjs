// Reads properties.csv (the source of truth) and:
//   1. validates it — duplicates, wrong regions, missing fields, missing photos
//   2. regenerates db/002_seed_properties.sql
//   3. writes build/cards/<region>.html — ready-to-paste card markup
//
// Run: npm run catalogue          (validate + generate)
//      npm run catalogue -- --check   (validate only, non-zero exit on error)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const checkOnly = process.argv.includes('--check');

const REGIONS = {
  'United Kingdom': 'united-kingdom.html',
  'Europe': 'europe.html',
  'USA': 'usa.html',
  'Caribbean Islands': 'caribbean-islands.html',
  'Central America': 'central-america.html',
};

// Countries that sit on the Central American mainland. Belize and Honduras have
// a Caribbean coastline, which is how they end up filed under the islands.
const CENTRAL_AMERICA_HINTS = [
  'belize', 'costa rica', 'panama', 'nicaragua', 'honduras', 'guatemala',
  'el salvador', 'mexico', 'roatán', 'roatan',
];
const CARIBBEAN_HINTS = [
  'bahamas', 'turks', 'caicos', 'dominican', 'barbados', 'jamaica', 'antigua',
  'st lucia', 'saint lucia', 'grenada', 'aruba', 'curacao', 'curaçao', 'cuba',
];

// --- CSV parsing (handles quoted fields and embedded commas) -----------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map(h => h.trim());
  return rows
    .filter(r => r.some(v => v.trim()))
    .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const slugify = s => String(s).toLowerCase().normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 60);

const hash6 = s => createHash('sha256').update(s).digest('hex').slice(0, 6);

// --- Load -------------------------------------------------------------------
const rows = parseCsv(readFileSync('properties.csv', 'utf8'));
const live = rows.filter(r => (r.status || 'live').toLowerCase() !== 'hidden');

const errors = [], warnings = [];
const problem = (list, row, msg) =>
  list.push(`${(row.title || row.slug || '(no title)').padEnd(28)} ${msg}`);

// --- Validate ---------------------------------------------------------------

// Required fields
for (const r of live) {
  for (const field of ['region', 'sub', 'title', 'type', 'owner_url', 'image']) {
    if (!r[field]) problem(errors, r, `missing "${field}"`);
  }
  if (r.region && !REGIONS[r.region]) {
    problem(errors, r, `region "${r.region}" is not one of: ${Object.keys(REGIONS).join(', ')}`);
  }
  if (r.owner_url && !/^https?:\/\//i.test(r.owner_url)) {
    problem(errors, r, `owner_url does not start with http`);
  }
  if (r.image && !existsSync(r.image)) {
    problem(errors, r, `photo not found: ${r.image}`);
  }
  for (const n of ['beds', 'baths']) {
    if (r[n] && !/^\d+(\.\d+)?$/.test(r[n])) problem(warnings, r, `${n} = "${r[n]}" is not a number`);
  }
}

// THE duplicate check Gary asked about: same owner website listed twice.
const byUrl = {};
for (const r of live) {
  const key = (r.owner_url || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
  if (key) (byUrl[key] ||= []).push(r);
}
for (const [url, group] of Object.entries(byUrl)) {
  if (group.length > 1) {
    problem(errors, group[0],
      `DUPLICATE — ${url} is listed ${group.length}x (${group.map(g => g.slug).join(', ')})`);
  }
}

// Same place name twice — usually fine (9 legitimate Disney villas), but worth eyeballing
const byTitle = {};
for (const r of live) (byTitle[`${r.region}|${r.title.toLowerCase()}`] ||= []).push(r);
for (const [key, group] of Object.entries(byTitle)) {
  if (group.length > 1) {
    warnings.push(`${group[0].title.padEnd(28)} appears ${group.length}x in ${group[0].region} — check these are genuinely different properties`);
  }
}

// Slug uniqueness
const bySlug = {};
for (const r of live) (bySlug[r.slug] ||= []).push(r);
for (const [slug, group] of Object.entries(bySlug)) {
  if (group.length > 1) problem(errors, group[0], `slug "${slug}" used ${group.length}x`);
  if (slug && slugify(slug) !== slug) problem(errors, group[0], `slug "${slug}" is not URL-safe`);
}

// Region sanity — the thing Gary noticed
for (const r of live) {
  const hay = `${r.sub} ${r.title}`.toLowerCase();
  const central = CENTRAL_AMERICA_HINTS.some(h => hay.includes(h));
  const caribbean = CARIBBEAN_HINTS.some(h => hay.includes(h));
  if (central && r.region === 'Caribbean Islands') {
    problem(warnings, r, `is under Caribbean Islands but "${r.sub}" is Central America`);
  }
  if (caribbean && r.region === 'Central America') {
    problem(warnings, r, `is under Central America but "${r.sub}" reads as Caribbean`);
  }
  const subL = (r.sub || '').toLowerCase(), regL = r.region.toLowerCase();
  if (subL && (subL === regL || regL.includes(subL) || subL.includes(regL))) {
    problem(warnings, r, `sub-region is just "${r.sub}" — too vague to group by`);
  }
}

// Slug should not give away the owner's domain
for (const r of live) {
  if (!r.owner_url || !r.slug) continue;
  try {
    const host = new URL(r.owner_url).hostname.replace(/^www\./, '').split('.')[0];
    if (host.length > 3 && r.slug.includes(host)) {
      problem(warnings, r, `slug contains "${host}", which hints at the owner domain`);
    }
  } catch { problem(errors, r, `owner_url is not a valid URL`); }
}

// --- Report -----------------------------------------------------------------
console.log(`\nproperties.csv — ${rows.length} rows (${live.length} live, ${rows.length - live.length} hidden)\n`);

const counts = {};
for (const r of live) counts[r.region] = (counts[r.region] || 0) + 1;
for (const region of Object.keys(REGIONS)) {
  console.log(`  ${String(counts[region] || 0).padStart(3)}  ${region}`);
}

if (errors.length) {
  console.log(`\nERRORS (${errors.length}) — these must be fixed:`);
  errors.forEach(e => console.log(`  ✗ ${e}`));
}
if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}) — worth a look:`);
  warnings.forEach(w => console.log(`  ! ${w}`));
}
if (!errors.length && !warnings.length) console.log('\nno problems found');

if (errors.length) { console.log(''); process.exit(1); }
if (checkOnly) { console.log(''); process.exit(0); }

// --- Generate ---------------------------------------------------------------

// Seed SQL
const q = s => s === null || s === undefined || s === '' ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
writeFileSync('db/002_seed_properties.sql',
`-- Generated by scripts/from-csv.mjs from properties.csv. Do not hand-edit.
-- ${live.length} properties.

insert into properties (slug, region, owner_url, title, sub) values
${live.map(r => `  (${q(r.slug)}, ${q(r.region)}, ${q(r.owner_url)}, ${q(r.title)}, ${q(r.sub)})`).join(',\n')}
on conflict (slug) do update
  set region = excluded.region,
      owner_url = excluded.owner_url,
      title = excluded.title,
      sub = excluded.sub;

-- Anything removed from the spreadsheet is removed from the directory too.
delete from properties where slug not in (
${live.map(r => `  ${q(r.slug)}`).join(',\n')}
);
`);
console.log(`\ndb/002_seed_properties.sql   ${live.length} rows`);

// Card markup, grouped the way the region pages are
mkdirSync('build/cards', { recursive: true });
const card = r => {
  const label = `${r.type} in ${r.title}`;
  const pool = r.pool
    ? `\n            <div class="prop-pool"><i data-lucide="waves"></i>${esc(r.pool)}</div>` : '';
  // "1 Bed", not "1 Beds" — matches the existing cards
  const plural = (n, word) => `${esc(n)} ${word}${Number(n) === 1 ? '' : 's'}`;
  const meta = [
    r.beds ? `\n              <span><i data-lucide="bed-double"></i>${plural(r.beds, 'Bed')}</span>` : '',
    r.baths ? `\n              <span><i data-lucide="bath"></i>${plural(r.baths, 'Bath')}</span>` : '',
  ].join('');
  return `        <a class="prop-card reveal" href="/go/${esc(r.slug)}" target="_blank" aria-label="${esc(label)}, visit owner's website" rel="nofollow noopener">
          <div class="prop-media">${pool}
            <img src="${esc(r.image)}" alt="${esc(label)}" loading="lazy">
          </div>
          <div class="prop-body">
            <span class="prop-sub">${esc(r.sub)}</span>
            <h3>${esc(r.title)}</h3>
            <p class="prop-type">${esc(r.type)}</p>
            <div class="prop-meta">${meta}
            </div>
            <span class="prop-cta">View owner&rsquo;s website <i data-lucide="arrow-up-right"></i></span>
          </div>
        </a>`;
};

for (const [region, file] of Object.entries(REGIONS)) {
  const group = live.filter(r => r.region === region);
  if (!group.length) continue;
  const bySub = {};
  for (const r of group) (bySub[r.sub] ||= []).push(r);
  const out = [
    `<!-- ${region} — ${group.length} homes. Generated from properties.csv.`,
    `     Paste the cards into the matching .prop-grid in ${file}.`,
    `     Remember to update the "N homes" count in each .region-group-head. -->`,
    '',
    ...Object.entries(bySub).map(([sub, list]) =>
      `<!-- ${sub} — ${list.length} -->\n${list.map(card).join('\n')}`),
  ].join('\n');
  writeFileSync(`build/cards/${file}`, out + '\n');
  console.log(`build/cards/${file.padEnd(24)} ${group.length} cards`);
}
console.log('');
