// Paywall regression tests. Run: npm test
//
// These cover the two failure modes that would silently give the product away:
//   1. an owner URL appearing in a public HTML file
//   2. the gate emitting an owner URL to a request with no valid session
//
// No Stripe or Supabase credentials are needed: the unauthenticated path
// returns before any database call, which is exactly the path being asserted.
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

// createClient() validates that a URL and key are present at import time.
process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY ||= 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-key';

const properties = JSON.parse(readFileSync('scripts/properties.json', 'utf8'));
const ownerHosts = [...new Set(
  properties.map(p => new URL(p.owner_url).hostname.replace(/^www\./, ''))
)];

let failures = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  ok   ${name}`); }
  catch (err) { failures++; console.log(`  FAIL ${name}\n       ${err.message}`); }
};
const testAsync = async (name, fn) => {
  try { await fn(); console.log(`  ok   ${name}`); }
  catch (err) { failures++; console.log(`  FAIL ${name}\n       ${err.message}`); }
};

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    ended: false,
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    getHeader(k) { return this.headers[k.toLowerCase()]; },
    end(chunk) { if (chunk) this.body += chunk; this.ended = true; return this; },
  };
}

const mockReq = (query = {}, headers = {}, method = 'GET') => ({ method, query, headers });

console.log('\nstatic: owner URLs must not be in any public file');

test('no owner domain in any .html file', () => {
  const offenders = [];
  for (const file of readdirSync('.').filter(f => f.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    for (const host of ownerHosts) if (html.includes(host)) offenders.push(`${file} → ${host}`);
  }
  assert.deepEqual(offenders, [], `owner URLs leaked into HTML:\n${offenders.join('\n')}`);
});

test('no owner domain in the client-side JS', () => {
  const offenders = [];
  for (const file of readdirSync('js').filter(f => f.endsWith('.js'))) {
    const js = readFileSync(`js/${file}`, 'utf8');
    for (const host of ownerHosts) if (js.includes(host)) offenders.push(`js/${file} → ${host}`);
  }
  assert.deepEqual(offenders, [], `owner URLs leaked into JS:\n${offenders.join('\n')}`);
});

test('every region-page link points at /go/<slug>', () => {
  const files = ['united-kingdom.html', 'europe.html', 'usa.html',
                 'caribbean-islands.html', 'central-america.html'];
  let count = 0;
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const cards = html.match(/<a class="prop-card reveal" href="([^"]+)"/g) || [];
    for (const card of cards) {
      const href = card.match(/href="([^"]+)"/)[1];
      assert.ok(href.startsWith('/go/'), `${file}: card href is "${href}", expected /go/<slug>`);
      count++;
    }
  }
  assert.equal(count, properties.length, `expected ${properties.length} cards, found ${count}`);
});

test('every /go/ slug resolves to a seeded property', () => {
  const known = new Set(properties.map(p => p.slug));
  for (const file of readdirSync('.').filter(f => f.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/href="\/go\/([^"]+)"/g)) {
      assert.ok(known.has(m[1]), `${file}: /go/${m[1]} has no matching property row`);
    }
  }
});

test('slugs are unique', () => {
  const slugs = properties.map(p => p.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate slugs found');
});

test('robots.txt disallows the redirect and API paths', () => {
  const robots = readFileSync('robots.txt', 'utf8');
  for (const path of ['/go/', '/api/']) {
    assert.ok(robots.includes(`Disallow: ${path}`), `robots.txt is missing Disallow: ${path}`);
  }
});

console.log('\ngate: unauthenticated requests must never receive an owner URL');

const { default: gate } = await import('../api/go/[slug].js');

await testAsync('no cookie → 302 to the unlock panel', async () => {
  const res = mockRes();
  await gate(mockReq({ slug: 'lanner-cornwall' }), res);
  assert.equal(res.statusCode, 302);
  assert.match(res.getHeader('location'), /^\/unlock\.html\?next=lanner-cornwall$/);
});

await testAsync('no cookie → response body carries nothing', async () => {
  const res = mockRes();
  await gate(mockReq({ slug: 'lanner-cornwall' }), res);
  assert.equal(res.body, '', 'gate wrote a body on the unauthenticated path');
  for (const host of ownerHosts) {
    assert.ok(!JSON.stringify(res).includes(host), `owner domain ${host} appeared in the response`);
  }
});

await testAsync('no cookie → every known slug redirects, none leak', async () => {
  for (const p of properties) {
    const res = mockRes();
    await gate(mockReq({ slug: p.slug }), res);
    assert.equal(res.statusCode, 302, `${p.slug}: expected 302`);
    assert.ok(res.getHeader('location').startsWith('/unlock.html'),
      `${p.slug}: redirected to ${res.getHeader('location')}, not the unlock panel`);
    assert.ok(!res.getHeader('location').includes('http'),
      `${p.slug}: Location header contains an absolute URL`);
  }
});

await testAsync('gate responses are never cached', async () => {
  const res = mockRes();
  await gate(mockReq({ slug: 'lanner-cornwall' }), res);
  assert.match(res.getHeader('cache-control'), /no-store/);
  assert.match(res.getHeader('x-robots-tag'), /noindex/);
});

await testAsync('a garbage slug does not reach the database', async () => {
  const res = mockRes();
  await gate(mockReq({ slug: "'; drop table properties; --" }), res);
  assert.equal(res.statusCode, 302);
  assert.ok(res.getHeader('location').startsWith('/unlock.html'));
});

await testAsync('non-GET is rejected', async () => {
  const res = mockRes();
  await gate(mockReq({ slug: 'lanner-cornwall' }, {}, 'POST'), res);
  assert.equal(res.statusCode, 405);
});

console.log(failures ? `\n${failures} FAILED\n` : `\nall passed\n`);
process.exit(failures ? 1 : 0);
