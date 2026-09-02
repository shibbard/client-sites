// Pulls the Google Sheet down into properties.csv.
//
//   npm run pull
//
// The sheet is the copy Gary edits. Everything else in the pipeline reads
// properties.csv, so this is the only place the sheet is touched.
//
// Column ORDER in the sheet does not matter — every script looks columns up by
// their heading — so the sheet can be arranged however suits Gary. Column
// NAMES do matter: don't rename the headings.
import { writeFileSync, existsSync, copyFileSync, readFileSync } from 'node:fs';

const SHEET_ID = process.env.HFH_SHEET_ID || '1ooyztnYbIPuLL9HJAm4wzJ0l0RDRq26VFji5IEIB2Pk';
const GID = process.env.HFH_SHEET_GID || '2088743846';

const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

const REQUIRED = ['owner_url', 'region', 'sub', 'title', 'type', 'image', 'slug', 'status', 'notes'];

const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
if (!res.ok) {
  console.error(`\nCould not read the sheet (${res.status}).`);
  console.error('Check it is shared as "Anyone with the link can view".\n');
  process.exit(1);
}

const csv = await res.text();

if (/^\s*<!DOCTYPE|<html/i.test(csv)) {
  console.error('\nGoogle returned a login page rather than the sheet.');
  console.error('Set sharing to "Anyone with the link can view".\n');
  process.exit(1);
}

const header = (csv.split('\n')[0] || '').split(',').map(h => h.trim().replace(/^"|"$/g, ''));
const missing = REQUIRED.filter(c => !header.includes(c));
if (missing.length) {
  console.error(`\nThe sheet is missing these columns: ${missing.join(', ')}`);
  console.error(`Found: ${header.join(', ')}\n`);
  process.exit(1);
}

// Keep the previous version around — a bad paste in the sheet shouldn't lose data.
if (existsSync('properties.csv')) {
  copyFileSync('properties.csv', 'properties.previous.csv');
}

writeFileSync('properties.csv', '﻿' + csv.replace(/\r?\n/g, '\r\n'));

const rows = csv.trim().split(/\r?\n/).length - 1;
const before = existsSync('properties.previous.csv')
  ? readFileSync('properties.previous.csv', 'utf8').trim().split(/\r?\n/).length - 1 : 0;

console.log(`\npulled ${rows} rows from the sheet` + (before ? ` (was ${before})` : ''));
if (before && rows !== before) console.log(`  ${rows > before ? '+' : ''}${rows - before} row(s)`);
console.log(`\nnext:  npm run enrich     fill in anything new from its link`);
console.log(`       npm run catalogue  check it and rebuild\n`);
