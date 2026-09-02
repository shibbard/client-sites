// Fills in the spreadsheet from the owner links.
//
//   node scripts/enrich.mjs            fill every row that has a link but is incomplete
//   node scripts/enrich.mjs --dry      show what it would do, change nothing
//   node scripts/enrich.mjs --only 3   just row 3
//
// Gary pastes owner_url into a new row and leaves the rest blank. This visits
// each site, grabs the best photo, and guesses the other fields. Anything it
// guesses is listed in the "notes" column as CHECK:<field> so a human knows
// what to glance at — it never overwrites a cell that already has something in
// it, so corrections stick.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (compatible; HomeForHoliday-directory/1.0; +https://home-for-holiday.getdigitaldone.co.uk)';
const TARGET_W = 720, TARGET_H = 540;
const PAUSE_MS = 1500;                 // be polite to the owners' servers

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const only = args.includes('--only') ? Number(args[args.indexOf('--only') + 1]) : null;

const JUNK = /favicon|apple-touch|logo|icon|sprite|placeholder|pixel|spacer|badge|award|tripadvisor|facebook|twitter|instagram|paypal|visa|mastercard|iteracy|web-design|webdesign|map-pin|arrow|button|bullet|banner-ad/i;

// --- where a place belongs --------------------------------------------------
const REGION_HINTS = [
  ['United Kingdom', /cornwall|devon|dorset|somerset|wales|scotland|yorkshire|cumbria|norfolk|suffolk|northumberland|highlands|snowdonia|lake district|cotswold|new forest|pembrokeshire|anglesey|argyll|perthshire|skye|gloucestershire|hampshire|sussex|kent|derbyshire|shropshire|lancashire/i],
  ['USA', /florida|orlando|disney|kissimmee|carolina|alabama|hawaii|missouri|gulf shores|myrtle beach|texas|california|arizona|nevada|georgia|tennessee/i],
  ['Europe', /spain|costa blanca|costa del sol|andalucia|mallorca|ibiza|canary|tenerife|lanzarote|france|dordogne|brittany|provence|riviera|italy|tuscany|sicily|rome|portugal|algarve|greece|crete|cyprus|malta|croatia/i],
  ['Caribbean Islands', /bahamas|turks|caicos|barbados|jamaica|antigua|st lucia|saint lucia|grenada|aruba|curacao|dominican republic|punta cana|st martin|anguilla/i],
  ['Central America', /costa rica|belize|panama|nicaragua|honduras|roatan|roatán|guatemala|mexico|tulum|akumal|merida|mérida|playa del carmen/i],
];

const TYPE_HINTS = [
  ['Barn Conversion', /barn conversion|converted barn/i],
  ['Lighthouse', /lighthouse/i],
  ['Mansion', /mansion/i],
  ['Villa', /\bvilla\b/i],
  ['Cottage', /\bcottages?\b/i],
  ['Apartment', /\bapartments?\b|\bflat\b/i],
  ['Condo', /\bcondo(minium)?\b/i],
  ['Cabin', /\bcabins?\b|\blodges?\b/i],
  ['Bungalow', /\bbungalows?\b/i],
  ['House', /\bhouse\b|\bhomes?\b/i],
];

// --- CSV --------------------------------------------------------------------
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i+1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim()));
}
const cell = v => /[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : (v ?? '');

const slugify = s => String(s).toLowerCase().normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 60);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(u, buf = false) {
  const res = await fetch(u, { headers: { 'User-Agent': UA }, redirect: 'follow',
                              signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return buf ? Buffer.from(await res.arrayBuffer()) : res.text();
}

const dimensions = f => {
  try {
    const [w, h] = execFileSync('ffprobe',
      ['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0', f],
      { encoding: 'utf8' }).trim().split(',').map(Number);
    return Number.isFinite(w) && Number.isFinite(h) ? { w, h } : null;
  } catch { return null; }
};

// --- load -------------------------------------------------------------------
const rows = parseCsv(readFileSync('properties.csv', 'utf8'));
const header = rows.shift();
const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

for (const need of ['owner_url', 'image', 'title', 'type', 'region', 'slug', 'notes']) {
  if (col[need] === undefined) {
    console.error(`properties.csv has no "${need}" column`);
    process.exit(1);
  }
}

const existingSlugs = new Set(rows.map(r => (r[col.slug] || '').trim()).filter(Boolean));
const blank = v => !String(v ?? '').trim();

const todo = rows
  .map((r, i) => ({ r, i }))
  .filter(({ r }) => !blank(r[col.owner_url]))
  .filter(({ r }) => (r[col.status] || 'live').toLowerCase() !== 'hidden')
  .filter(({ r }) => blank(r[col.image]) || blank(r[col.title]) || blank(r[col.type]) || blank(r[col.region]))
  .filter(({ i }) => only === null || i + 1 === only);

if (!todo.length) {
  console.log('\nNothing to fill in — every row with a link already has its details.\n');
  process.exit(0);
}

console.log(`\n${todo.length} row(s) to fill in${dry ? ' (dry run)' : ''}\n`);

const staging = join(tmpdir(), 'hfh-enrich');
let filled = 0;

for (const { r, i } of todo) {
  const url = r[col.owner_url].trim();
  process.stdout.write(`  row ${i + 1}  ${url}\n`);

  let html;
  try { html = await get(url); }
  catch (err) { console.log(`         could not reach it (${err.message}) — skipped\n`); continue; }

  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
  const guessed = [];

  const pageTitle = (html.match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim() || '';
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, '').trim() || '';

  // region
  if (blank(r[col.region])) {
    const hit = REGION_HINTS.find(([, re]) => re.test(text) || re.test(url));
    if (hit) { r[col.region] = hit[0]; guessed.push('region'); }
  }
  // type
  if (blank(r[col.type])) {
    const hit = TYPE_HINTS.find(([, re]) => re.test(pageTitle) || re.test(h1)) ||
                TYPE_HINTS.find(([, re]) => re.test(text));
    if (hit) { r[col.type] = hit[0]; guessed.push('type'); }
  }
  // title — best effort; almost always worth a human glance
  if (blank(r[col.title])) {
    const source = h1 || pageTitle;
    const place = source
      .replace(/\b(holiday|self[- ]catering|luxury|cornish|welsh|scottish)\b/gi, '')
      .replace(/\b(cottages?|villas?|apartments?|houses?|lettings?|rentals?|accommodation)\b/gi, '')
      .split(/[|–—-]/)[0].replace(/\s+in\s+/i, ' ').replace(/\s{2,}/g, ' ')
      .replace(/^[\s,]+|[\s,]+$/g, '').trim();
    if (place) { r[col.title] = place.slice(0, 60); guessed.push('title'); }
  }
  // beds / baths / pool
  if (blank(r[col.beds])) {
    const n = (text.match(/(\d+)\s*bed(?:room)?s?\b/i) || [])[1];
    if (n) { r[col.beds] = n; guessed.push('beds'); }
  }
  if (blank(r[col.baths])) {
    const n = (text.match(/(\d+)\s*bath(?:room)?s?\b/i) || [])[1];
    if (n) { r[col.baths] = n; guessed.push('baths'); }
  }
  if (blank(r[col.pool])) {
    if (/private\s+pool/i.test(text)) { r[col.pool] = 'Private Pool'; guessed.push('pool'); }
    else if (/communal\s+pool|shared\s+pool/i.test(text)) { r[col.pool] = 'Communal Pool'; guessed.push('pool'); }
  }
  // slug
  if (blank(r[col.slug])) {
    let base = slugify(r[col.title] || new URL(url).hostname.replace(/^www\./, ''));
    let s = base, n = 1;
    while (existingSlugs.has(s)) { n++; s = `${base}-${n}`; }
    r[col.slug] = s; existingSlugs.add(s);
  }

  // photo — biggest usable landscape shot on the page
  if (blank(r[col.image])) {
    const base = new URL(url);
    const found = new Set();
    const add = raw => {
      if (!raw) return;
      const c = raw.trim().replace(/^['"]|['"]$/g, '');
      if (!c || c.startsWith('data:') || !/\.(jpe?g|png|webp)(\?|#|$)/i.test(c)) return;
      try { found.add(new URL(c, base).href); } catch {}
    };
    for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) add(m[1]);
    for (const m of html.matchAll(/srcset=["']([^"']+)["']/gi))
      for (const p of m[1].split(',')) add(p.trim().split(/\s+/)[0]);
    for (const m of html.matchAll(/data-(?:bg|src|image|original|lazy|large)=["']([^"']+)["']/gi)) add(m[1]);
    for (const m of html.matchAll(/background-image\s*:\s*url\(([^)]+)\)/gi)) add(m[1]);
    for (const m of html.matchAll(/<meta[^>]+(?:og:image|twitter:image)[^>]+content=["']([^"']+)["']/gi)) add(m[1]);

    const cands = [...found].filter(u => !JUNK.test(u)).slice(0, 16);
    let best = null;
    if (!dry) {
      mkdirSync(staging, { recursive: true });
      for (const [n, src] of cands.entries()) {
        const f = join(staging, `c${i}-${n}${(src.match(/\.(jpe?g|png|webp)/i) || ['.jpg'])[0]}`);
        try {
          writeFileSync(f, await get(src, true));
          const d = dimensions(f);
          if (!d || d.w < 600 || d.w / d.h <= 0.9) continue;
          if (!best || d.w * d.h > best.area) best = { f, area: d.w * d.h, ...d };
        } catch {}
      }
    }
    if (best) {
      const out = `images/${r[col.slug]}.webp`;
      if (!existsSync(out)) {
        execFileSync('ffmpeg', ['-v','error','-y','-i', best.f, '-vf',
          `scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=increase,crop=${TARGET_W}:${TARGET_H}`,
          '-c:v','libwebp','-quality','82', out]);
      }
      r[col.image] = out;
      console.log(`         photo  ${out}  (from ${best.w}x${best.h}, ${cands.length} candidates)`);
    } else if (!dry) {
      console.log(`         no usable photo found — add one by hand`);
    }
  }

  if (blank(r[col.status])) r[col.status] = 'draft';

  if (guessed.length) {
    const note = `CHECK: ${guessed.join(', ')}`;
    r[col.notes] = blank(r[col.notes]) ? note : `${r[col.notes]}; ${note}`;
  }
  console.log(`         ${r[col.region] || '?'} / ${r[col.title] || '?'} / ${r[col.type] || '?'}  ${r[col.beds] || '?'}bed ${r[col.baths] || '?'}bath`);
  console.log(`         guessed: ${guessed.join(', ') || 'nothing'}\n`);
  filled++;
  await sleep(PAUSE_MS);
}

if (dry) {
  console.log(`Dry run — properties.csv not written.\n`);
} else {
  writeFileSync('properties.csv',
    '﻿' + [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n');
  console.log(`properties.csv updated — ${filled} row(s) filled in.`);
  console.log(`Check anything marked CHECK, then run: npm run catalogue\n`);
}
