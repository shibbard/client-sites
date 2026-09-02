// Checks that markup generated from properties.csv matches what is already on
// the region pages. If these drift, pasting generated cards would silently
// restyle the live site.
import { readFileSync, existsSync } from 'node:fs';

const FILES = ['united-kingdom.html', 'europe.html', 'usa.html',
               'caribbean-islands.html', 'central-america.html'];

const norm = s => s.replace(/\s+/g, ' ').trim();

function cards(html) {
  const out = {};
  let i = 0;
  while ((i = html.indexOf('<a class="prop-card reveal" href="/go/', i)) !== -1) {
    const end = html.indexOf('</a>', i);
    if (end === -1) break;
    const block = html.slice(i, end + 4);
    const slug = block.match(/href="\/go\/([^"]+)"/)[1];
    out[slug] = norm(block);
    i = end;
  }
  return out;
}

let same = 0, differing = [], missing = [];

for (const file of FILES) {
  const genPath = `build/cards/${file}`;
  if (!existsSync(genPath)) { console.log(`skip ${file} — not generated`); continue; }
  const gen = cards(readFileSync(genPath, 'utf8'));
  const live = cards(readFileSync(file, 'utf8'));

  for (const [slug, liveBlock] of Object.entries(live)) {
    if (!(slug in gen)) { missing.push(`${file}: ${slug} not in generated output`); continue; }
    if (gen[slug] === liveBlock) same++;
    else differing.push({ file, slug, gen: gen[slug], live: liveBlock });
  }
}

console.log(`\nidentical: ${same}`);
if (missing.length) {
  console.log(`\nnot generated (${missing.length}):`);
  missing.forEach(m => console.log('  ' + m));
}
if (differing.length) {
  console.log(`\ndiffering (${differing.length}):`);
  for (const d of differing.slice(0, 3)) {
    console.log(`\n  ${d.file} — ${d.slug}`);
    console.log(`    generated: ${d.gen}`);
    console.log(`    live     : ${d.live}`);
  }
  if (differing.length > 3) console.log(`\n  …and ${differing.length - 3} more`);
}
console.log('');
process.exit(differing.length ? 1 : 0);
