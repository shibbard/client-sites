// The paywall.
//
// The token check runs here, on the server, BEFORE the owner URL is put in a
// response. Nothing in this flow renders an owner URL into HTML, so view-source
// on a region page shows only /go/<slug>.
//
// No database: the cookie is a signed token carrying the buyer's email and
// expiry, and the slug is looked up in the catalogue that ships with this
// function.
import { lookup } from '../_catalogue.js';
import { readToken, verify } from '../../lib/token.js';
import { isThrottled } from '../../lib/throttle.js';
import { redirect, methodGuard } from '../../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET', 'HEAD'])) return;

  // Never let a crawler or a shared cache hold one of these responses.
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const slug = String(req.query.slug || '').trim().toLowerCase();
  if (!slug) return redirect(res, '/destinations.html');

  const next = encodeURIComponent(slug);

  let access;
  try {
    access = await verify(readToken(req));
  } catch (err) {
    // Only reachable if ACCESS_SECRET is missing or malformed in this
    // environment — fail closed rather than opening the gate.
    console.error('gate: token check failed', err.message);
    return redirect(res, `/unlock.html?next=${next}&error=1`);
  }

  // No token, a tampered one, or one whose 30 days have run out.
  if (!access) return redirect(res, `/unlock.html?next=${next}`);

  if (isThrottled(access.email)) {
    res.statusCode = 429;
    res.setHeader('Retry-After', '600');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(`<!doctype html><meta charset="utf-8">
<title>Just a moment</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<div style="font:16px/1.6 system-ui;max-width:34rem;margin:15vh auto;padding:0 1.25rem">
<h1 style="font-size:1.3rem">Just a moment</h1>
<p>That is a lot of properties in a short space of time, so we have paused this
link for a few minutes.</p>
<p>If this was you, it will clear on its own &mdash; or email
<a href="mailto:hfh.travel@outlook.com">hfh.travel@outlook.com</a> and we will sort it out.</p>
<p><a href="/destinations.html">Back to the directory</a></p></div>`);
  }

  const property = lookup(slug);
  if (!property) return redirect(res, '/destinations.html?notfound=1');

  return redirect(res, property.url);
}
