// The emailed link. Verifies the token in the URL and moves it into a cookie,
// so the address bar stops carrying it around.
import { verify, peek, setAccessCookie } from '../lib/token.js';
import { redirect, methodGuard } from '../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;

  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  // The token is in the query string here. Without this, it would travel to the
  // owner's site in the Referer header on the next click.
  res.setHeader('Referrer-Policy', 'no-referrer');

  const token = String(req.query.t || '');
  const next = String(req.query.next || '').replace(/[^a-z0-9-]/gi, '').slice(0, 80);

  const access = await verify(token).catch(err => {
    console.error('unlock: token check failed', err.message);
    return null;
  });

  if (!access) {
    // Tell them which it is: an expired link is a renewal, a broken one is not.
    const stale = await peek(token).catch(() => null);
    return redirect(res, stale ? '/unlock.html?renew=1' : '/unlock.html?error=link');
  }

  setAccessCookie(res, token);
  return redirect(res, next ? `/go/${next}` : '/unlock.html?welcome=1');
}
