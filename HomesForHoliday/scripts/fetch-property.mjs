// Pulls the photos and details off an owner's website so a property can be
// added from little more than the link.
//
//   node scripts/fetch-property.mjs <url>              list what it found
//   node scripts/fetch-property.mjs <url> --pick 3     grab photo 3 and write a CSV row
//   node scripts/fetch-property.mjs <url> --pick 3 --slug sennen-cornwall
//
// Photos on these sites are rarely in <img> tags — they are usually CSS
// backgrounds or data-bg attributes driving a slideshow — so all of those are
// harvested, not just <img>.
//
// The photos belong to the property owner. Only use them for the directory
// listing that promotes them, and only with the owner's agreement.
import { writeFileSync, mkdirSync, existsSync, appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (compatible; HomeForHoliday-directory/1.0; +https://home-for-holiday.getdigitaldone.co.uk)';
const TARGET_W = 720, TARGET_H = 540;   // matches every existing card photo
const MAX_CANDIDATES = 24;

const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--'));
const flag = name => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? true);
};

if (!url) {
  console.error('usage: node scripts/fetch-property.mjs <owner-url> [--pick N] [--slug name]');
  process.exit(1);
}

const slugify = s => String(s).toLowerCase().normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 60);

// Things that are never the property photo.
const JUNK = /favicon|apple-touch|logo|icon|sprite|placeholder|pixel|spacer|badge|award|tripadvisor|facebook|twitter|instagram|paypal|visa|mastercard|iteracy|web-design|webdesign|map-pin|arrow|button|bullet/i;

async function get(u, asBuffer = false) {
  const res = await fetch(u, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
}

const dimensions = file => {
  try {
    const out = execFileSync('ffprobe',
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
       '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
    const [w, h] = out.split(',').map(Number);
    return Number.isFinite(w) && Number.isFinite(h) ? { w, h } : null;
  } catch { return null; }
};

// --- harvest ----------------------------------------------------------------
const html = await get(url);
const base = new URL(url);

const found = new Set();
const add = raw => {
  if (!raw) return;
  const clean = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!clean || clean.startsWith('data:')) return;
  if (!/\.(jpe?g|png|webp)(\?|#|$)/i.test(clean)) return;
  try { found.add(new URL(clean, base).href); } catch {}
};

for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) add(m[1]);
for (const m of html.matchAll(/srcset=["']([^"']+)["']/gi)) {
  for (const part of m[1].split(',')) add(part.trim().split(/\s+/)[0]);
}
// Lazy-loading and slideshow attributes — where these sites actually keep them
for (const m of html.matchAll(/data-(?:bg|src|image|original|lazy|large)=["']([^"']+)["']/gi)) add(m[1]);
for (const m of html.matchAll(/background-image\s*:\s*url\(([^)]+)\)/gi)) add(m[1]);
for (const m of html.matchAll(/<meta[^>]+(?:og:image|twitter:image)[^>]+content=["']([^"']+)["']/gi)) add(m[1]);
for (const m of html.matchAll(/content=["']([^"']+)["'][^>]+(?:og:image|twitter:image)/gi)) add(m[1]);

const candidates = [...found].filter(u => !JUNK.test(u)).slice(0, MAX_CANDIDATES);

// --- details ----------------------------------------------------------------
const pageTitle = (html.match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim() || '';
const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, '').trim() || '';
const metaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
const bedsGuess = (html.match(/(\d+)\s*(?:bed(?:room)?s?)\b/i) || [])[1] || '';
const bathsGuess = (html.match(/(\d+)\s*(?:bath(?:room)?s?)\b/i) || [])[1] || '';
const poolGuess = /private\s+pool/i.test(html) ? 'Private Pool'
  : /communal\s+pool|shared\s+pool/i.test(html) ? 'Communal Pool' : '';

console.log(`\n${url}`);
console.log(`  title       ${pageTitle}`);
if (h1) console.log(`  h1          ${h1}`);
if (metaDesc) console.log(`  description ${metaDesc.slice(0, 110)}${metaDesc.length > 110 ? '…' : ''}`);
console.log(`  beds/baths  ${bedsGuess || '?'} / ${bathsGuess || '?'}   (guess — check these)`);
if (poolGuess) console.log(`  pool        ${poolGuess}`);
console.log(`\n  ${candidates.length} candidate photo(s):\n`);

if (!candidates.length) {
  console.log('  none found — the photos may be loaded by JavaScript. Save one by hand into images/.\n');
  process.exit(0);
}

// --- measure ----------------------------------------------------------------
const staging = join(tmpdir(), 'hfh-fetch');
mkdirSync(staging, { recursive: true });

const measured = [];
for (const [i, src] of candidates.entries()) {
  const file = join(staging, `cand-${i}${(src.match(/\.(jpe?g|png|webp)/i) || ['.jpg'])[0]}`);
  try {
    writeFileSync(file, await get(src, true));
    const dim = dimensions(file);
    if (!dim) continue;
    // Skip anything too small to be a hero shot, or badly portrait.
    const usable = dim.w >= 600 && dim.w / dim.h > 0.9;
    measured.push({ i, src, file, ...dim, usable });
  } catch (err) {
    measured.push({ i, src, file: null, w: 0, h: 0, usable: false, error: err.message });
  }
}

measured.sort((a, b) => (b.usable - a.usable) || (b.w * b.h - a.w * a.h));

measured.forEach((m, rank) => {
  const n = String(rank + 1).padStart(2);
  const size = m.w ? `${m.w}x${m.h}`.padEnd(11) : 'failed'.padEnd(11);
  const mark = m.usable ? ' ' : '·';
  console.log(`  ${n}${mark} ${size} ${m.src.replace(base.origin, '')}`);
});
console.log('\n  (· = too small or wrong shape)');

// --- pick -------------------------------------------------------------------
const pick = flag('pick');
if (!pick) {
  console.log(`\n  Re-run with --pick N to convert one and get a spreadsheet row.\n`);
  process.exit(0);
}

const chosen = measured[Number(pick) - 1];
if (!chosen || !chosen.file) { console.error(`\n  no candidate ${pick}\n`); process.exit(1); }

const slug = flag('slug') || slugify(h1 || pageTitle.split(/[|–-]/)[0] || base.hostname);
const out = `images/${slug}.webp`;

if (existsSync(out)) {
  console.error(`\n  ${out} already exists — pass a different --slug\n`);
  process.exit(1);
}

execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', chosen.file,
  '-vf', `scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=increase,crop=${TARGET_W}:${TARGET_H}`,
  '-c:v', 'libwebp', '-quality', '82', out]);

const kb = (readFileSync(out).length / 1024).toFixed(0);
console.log(`\n  saved  ${out}  (${TARGET_W}x${TARGET_H}, ${kb}KB, from ${chosen.w}x${chosen.h})`);

// A row to paste into properties.csv. Blanks are the bits needing a human.
const cell = v => /[",]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : (v ?? '');
const row = [slug, flag('region') || '', '', '', '', bedsGuess, bathsGuess,
             poolGuess, out, url, 'live', 'added from owner site — check details']
             .map(cell).join(',');

console.log(`\n  spreadsheet row (fill in region, sub, title, type):\n\n${row}\n`);

if (flag('append')) {
  appendFileSync('properties.csv', row + '\r\n');
  console.log('  appended to properties.csv — run: npm run catalogue\n');
}
