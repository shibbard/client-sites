// Replaces the owner URLs in the region pages with /go/<slug>.
// After this runs, no owner domain should appear in any .html file.
import { readFileSync, writeFileSync } from 'node:fs';

const rows = JSON.parse(readFileSync('scripts/properties.json', 'utf8'));
const byFile = rows.reduce((a, r) => ((a[r.file] ||= []).push(r), a), {});

const CARD_OPEN = /<a class="prop-card reveal" href="(https?:\/\/[^"]+)"([^>]*)>/g;

let total = 0;
for (const [file, props] of Object.entries(byFile)) {
  let html = readFileSync(file, 'utf8');
  let i = 0;

  html = html.replace(CARD_OPEN, (match, url, rest) => {
    const row = props[i++];
    if (!row) { throw new Error(`${file}: more cards than extracted rows`); }
    if (row.owner_url !== url) {
      throw new Error(`${file}: card ${i} url mismatch\n  html: ${url}\n  data: ${row.owner_url}`);
    }
    // nofollow: these are paid-access redirects, not endorsements to pass rank to.
    const attrs = rest
      .replace(/\s*rel="[^"]*"/, '')
      .replace(/\s*$/, '');
    total++;
    return `<a class="prop-card reveal" href="/go/${row.slug}"${attrs} rel="nofollow noopener">`;
  });

  if (i !== props.length) throw new Error(`${file}: rewrote ${i} of ${props.length}`);
  writeFileSync(file, html);
  console.error(`${file.padEnd(24)} ${i} links rewritten`);
}
console.error(`\ntotal ${total}`);
