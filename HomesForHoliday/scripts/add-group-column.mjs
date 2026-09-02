// The region pages group cards under an <h2> heading ("Southern England") that
// is coarser than the label printed on each card ("Hampshire"). The spreadsheet
// only captured the card label, so this backfills the heading each property
// currently sits under — without it the pages can't be regenerated faithfully.
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = {
  'united-kingdom.html': 'United Kingdom',
  'europe.html': 'Europe',
  'usa.html': 'USA',
  'caribbean-islands.html': 'Caribbean Islands',
  'central-america.html': 'Central America',
};

// slug -> { group, groupNote }
const placement = {};

for (const file of Object.keys(FILES)) {
  const html = readFileSync(file, 'utf8');
  for (const chunk of html.split('<div class="region-group">').slice(1)) {
    // Stop at the end of the grid so the footer CTA is never mistaken for a heading
    const body = chunk.split('</section>')[0];
    const head = (body.match(/<div class="region-group-head">[\s\S]*?<h2>([^<]*)<\/h2>/) || [])[1] || '';
    const note = (body.match(/<p style="max-width:60ch[^"]*">([\s\S]*?)<\/p>/) || [])[1] || '';
    for (const m of body.matchAll(/<a class="prop-card reveal" href="\/go\/([^"]+)"/g)) {
      placement[m[1]] = { group: head.trim(), note: note.trim() };
    }
  }
}

// --- rewrite the CSV with two extra columns ---------------------------------
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
  return rows;
}

const rows = parseCsv(readFileSync('properties.csv', 'utf8')).filter(r => r.some(v => v.trim()));
const header = rows.shift();
const iSlug = header.indexOf('slug');
const iSub = header.indexOf('sub');

// Insert "group" and "group_note" straight after "region" so the sheet reads
// region -> group -> sub, coarse to fine.
const iRegion = header.indexOf('region');
const newHeader = [...header];
newHeader.splice(iRegion + 1, 0, 'group', 'group_note');

const out = rows.map(r => {
  const p = placement[r[iSlug]] || { group: '', note: '' };
  const copy = [...r];
  copy.splice(iRegion + 1, 0, p.group, p.note);
  return copy;
});

const cell = v => /[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : (v ?? '');
writeFileSync('properties.csv',
  '﻿' + [newHeader, ...out].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n');

const grouped = out.filter(r => r[iRegion + 1]).length;
console.error(`properties.csv — ${out.length} rows, ${grouped} have a heading, ${out.length - grouped} are on ungrouped pages`);
