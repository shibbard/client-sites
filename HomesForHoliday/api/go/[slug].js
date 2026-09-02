// The paywall.
//
// The session check runs here, on the server, BEFORE the owner URL is put in a
// response. Nothing in this flow ever renders owner_url into HTML, so
// view-source on a region page shows only /go/<slug>.
import { admin } from '../../lib/supabase.js';
import { getMember, touchSession, isThrottled } from '../../lib/session.js';
import { redirect, json, methodGuard } from '../../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET', 'HEAD'])) return;

  // Never let a crawler or a shared cache hold one of these responses.
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const slug = String(req.query.slug || '').trim().toLowerCase();
  if (!slug) return redirect(res, '/destinations.html');

  const next = encodeURIComponent(slug);

  let member;
  try {
    member = await getMember(req);
  } catch (err) {
    console.error('gate: session lookup failed', err);
    return redirect(res, `/unlock.html?next=${next}&error=1`);
  }

  // Not signed in — send them to the unlock panel, remembering where they were.
  if (!member) return redirect(res, `/unlock.html?next=${next}`);

  // Signed in but the 30 days have lapsed.
  if (!member.hasAccess) return redirect(res, `/unlock.html?renew=1&next=${next}`);

  if (await isThrottled(member.id)) {
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
account for a few minutes.</p>
<p>If this was you, it will clear on its own &mdash; or email
<a href="mailto:hfh.travel@outlook.com">hfh.travel@outlook.com</a> and we will sort it out.</p>
<p><a href="/destinations.html">Back to the directory</a></p></div>`);
  }

  const { data: property } = await admin
    .from('properties').select('slug, owner_url').eq('slug', slug).maybeSingle();

  if (!property) return redirect(res, '/destinations.html?notfound=1');

  // Log first, then send them on.
  await Promise.all([
    admin.from('link_events').insert({
      member_id: member.id,
      slug: property.slug,
      referrer: (req.headers.referer || '').slice(0, 500) || null,
    }),
    touchSession(member.sessionId),
  ]).catch(err => console.error('gate: logging failed', err));

  return redirect(res, property.owner_url);
}
