// Paywall regression tests. Run: npm test
//
// These cover the ways the product could be given away by accident:
//   1. an owner URL appearing in a file the site serves
//   2. the gate emitting an owner URL to a request with no valid token
//   3. a token that has been tampered with or has expired still opening the gate
//
// No Stripe credentials are needed. ACCESS_SECRET is set to a throwaway value
// below, which is what makes the token tests possible without any account.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

process.env.ACCESS_SECRET ||= 'test-secret-that-is-at-least-32-characters-long';

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
const withToken = (slug, token) => mockReq({ slug }, { cookie: `hfh_access=${encodeURIComponent(token)}` });

console.log('\nstatic: owner URLs must not be in any file the site serves');

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

// Which files Vercel would actually upload. Anything not excluded here becomes
// a public URL, so this is the set that must be free of owner URLs.
const vercelIgnored = (() => {
  const patterns = readFileSync('.vercelignore', 'utf8')
    .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  return path => patterns.some(pattern => {
    if (pattern.endsWith('/')) return path === pattern.slice(0, -1) || path.startsWith(pattern);
    if (pattern.startsWith('*.')) return path.endsWith(pattern.slice(1));
    return path === pattern;
  });
})();

// The catalogue is the one place an owner URL is allowed to live, and it must
// stay inside api/, which Vercel treats as function source rather than static
// output. A copy anywhere else that gets uploaded would be a public URL.
test('the only owner URLs in the deployed files are in api/_catalogue.js', () => {
  const offenders = [];
  const skip = new Set(['node_modules', '.git', '.vercel', '.impeccable', 'images']);
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
      if (vercelIgnored(path)) continue;
      if (entry.isDirectory()) { walk(path); continue; }
      if (path === 'api/_catalogue.js') continue;
      if (/\.(webp|jpe?g|png|svg|ico|woff2?)$/i.test(path)) continue;
      const text = readFileSync(path, 'utf8');
      for (const host of ownerHosts) if (text.includes(host)) offenders.push(`${path} → ${host}`);
    }
  };
  walk('.');
  assert.deepEqual(offenders, [], `owner URLs in files that would be deployed:\n${offenders.join('\n')}`);
});

test('.vercelignore keeps the spreadsheet and scripts out of the deployment', () => {
  assert.ok(existsSync('.vercelignore'), '.vercelignore is missing — scripts/ and properties.csv would be public URLs');
  const ignore = readFileSync('.vercelignore', 'utf8');
  for (const path of ['scripts/', 'properties.csv', 'build/']) {
    assert.ok(ignore.includes(path), `.vercelignore does not exclude ${path}`);
  }
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

const { PROPERTIES, SLUGS } = await import('../api/_catalogue.js');

test('every /go/ slug resolves to a property in the catalogue', () => {
  const known = new Set(SLUGS);
  for (const file of readdirSync('.').filter(f => f.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/href="\/go\/([^"]+)"/g)) {
      assert.ok(known.has(m[1]), `${file}: /go/${m[1]} has no catalogue entry`);
    }
  }
});

test('the catalogue matches the extracted property list', () => {
  assert.equal(SLUGS.length, properties.length,
    `catalogue has ${SLUGS.length} entries, properties.json has ${properties.length} — run npm run links`);
  for (const p of properties) {
    assert.equal(PROPERTIES[p.slug]?.url, p.owner_url, `${p.slug}: catalogue URL does not match`);
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

console.log('\ntoken: only a correctly signed, in-date token counts');

const { sign, verify } = await import('../lib/token.js');
const inThirtyDays = new Date(Date.now() + 30 * 864e5);

await testAsync('a freshly signed token verifies', async () => {
  const token = await sign('buyer@example.com', inThirtyDays);
  const claims = await verify(token);
  assert.equal(claims?.email, 'buyer@example.com');
});

await testAsync('an edited payload is rejected', async () => {
  const token = await sign('buyer@example.com', inThirtyDays);
  const [payload, sig] = token.split('.');
  const flipped = payload.slice(0, -1) + (payload.endsWith('A') ? 'B' : 'A');
  assert.equal(await verify(`${flipped}.${sig}`), null);
});

await testAsync('an edited signature is rejected', async () => {
  const token = await sign('buyer@example.com', inThirtyDays);
  const [payload, sig] = token.split('.');
  const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
  assert.equal(await verify(`${payload}.${flipped}`), null);
});

await testAsync('a token signed with a different secret is rejected', async () => {
  const token = await sign('buyer@example.com', inThirtyDays);
  const real = process.env.ACCESS_SECRET;
  try {
    // A fresh module instance so it picks up the other secret.
    process.env.ACCESS_SECRET = 'a-completely-different-secret-of-adequate-length';
    const other = await import(`../lib/token.js?v=${Date.now()}`);
    assert.equal(await other.verify(token), null);
  } finally {
    process.env.ACCESS_SECRET = real;
  }
});

await testAsync('an expired token is rejected', async () => {
  const token = await sign('buyer@example.com', new Date(Date.now() - 60000));
  assert.equal(await verify(token), null);
});

await testAsync('rubbish in does not throw', async () => {
  for (const junk of ['', 'x', '.', 'a.b', 'a'.repeat(2000), '../../etc/passwd', null, 42, {}]) {
    assert.equal(await verify(junk), null, `verify(${JSON.stringify(junk)}) should be null`);
  }
});

console.log('\ngate: an owner URL only ever reaches a paid, in-date request');

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
  for (const slug of SLUGS) {
    const res = mockRes();
    await gate(mockReq({ slug }), res);
    assert.equal(res.statusCode, 302, `${slug}: expected 302`);
    assert.ok(res.getHeader('location').startsWith('/unlock.html'),
      `${slug}: redirected to ${res.getHeader('location')}, not the unlock panel`);
    assert.ok(!res.getHeader('location').includes('http'),
      `${slug}: Location header contains an absolute URL`);
  }
});

await testAsync('an expired token gets the unlock panel, not the owner site', async () => {
  const token = await sign('lapsed@example.com', new Date(Date.now() - 864e5));
  const res = mockRes();
  await gate(withToken('lanner-cornwall', token), res);
  assert.equal(res.statusCode, 302);
  assert.ok(res.getHeader('location').startsWith('/unlock.html'),
    `expired token was sent to ${res.getHeader('location')}`);
});

await testAsync('a tampered token gets the unlock panel, not the owner site', async () => {
  const token = await sign('cheat@example.com', inThirtyDays);
  const [payload, sig] = token.split('.');
  const res = mockRes();
  await gate(withToken('lanner-cornwall', `${payload}.${sig.slice(0, -1)}A`), res);
  assert.equal(res.statusCode, 302);
  assert.ok(res.getHeader('location').startsWith('/unlock.html'),
    `tampered token was sent to ${res.getHeader('location')}`);
});

await testAsync('a valid token reaches the owner URL', async () => {
  const token = await sign('paid@example.com', inThirtyDays);
  const res = mockRes();
  await gate(withToken('lanner-cornwall', token), res);
  assert.equal(res.statusCode, 302);
  assert.equal(res.getHeader('location'), PROPERTIES['lanner-cornwall'].url);
  assert.match(res.getHeader('cache-control'), /no-store/);
});

await testAsync('a valid token for an unknown slug goes nowhere useful', async () => {
  const token = await sign('paid2@example.com', inThirtyDays);
  const res = mockRes();
  await gate(withToken('no-such-property', token), res);
  assert.equal(res.getHeader('location'), '/destinations.html?notfound=1');
});

await testAsync('gate responses are never cached', async () => {
  const res = mockRes();
  await gate(mockReq({ slug: 'lanner-cornwall' }), res);
  assert.match(res.getHeader('cache-control'), /no-store/);
  assert.match(res.getHeader('x-robots-tag'), /noindex/);
});

await testAsync('a garbage slug is handled', async () => {
  const res = mockRes();
  await gate(mockReq({ slug: "'; drop table properties; --" }), res);
  assert.equal(res.statusCode, 302);
  assert.ok(res.getHeader('location').startsWith('/unlock.html'));
});

await testAsync('a slug that collides with an Object prototype key is not a property', async () => {
  const token = await sign('proto@example.com', inThirtyDays);
  const res = mockRes();
  await gate(withToken('constructor', token), res);
  assert.equal(res.getHeader('location'), '/destinations.html?notfound=1');
});

await testAsync('non-GET is rejected', async () => {
  const res = mockRes();
  await gate(mockReq({ slug: 'lanner-cornwall' }, {}, 'POST'), res);
  assert.equal(res.statusCode, 405);
});

console.log('\napi/me: says nothing to a request with no token');

const { default: me } = await import('../api/me.js');

await testAsync('no cookie → no access, nothing else', async () => {
  const res = mockRes();
  await me(mockReq({}, {}), res);
  assert.deepEqual(JSON.parse(res.body), { hasAccess: false, known: false });
});

await testAsync('valid cookie → access and the expiry, no owner URLs', async () => {
  const token = await sign('paid@example.com', inThirtyDays);
  const res = mockRes();
  await me(mockReq({}, { cookie: `hfh_access=${encodeURIComponent(token)}` }), res);
  const body = JSON.parse(res.body);
  assert.equal(body.hasAccess, true);
  assert.equal(body.email, 'paid@example.com');
  for (const host of ownerHosts) assert.ok(!res.body.includes(host), `${host} leaked from /api/me`);
});

console.log(failures ? `\n${failures} FAILED\n` : `\nall passed\n`);
process.exit(failures ? 1 : 0);
