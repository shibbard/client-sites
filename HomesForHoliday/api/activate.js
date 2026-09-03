// Instant access, straight back from Stripe.
//
// Stripe's redirect lands here with the checkout session id. We ask Stripe
// whether it was actually paid — the id alone proves nothing — then mint the
// token and set the cookie, so a buyer is through to the property they wanted
// without going via their inbox.
//
// The emailed link (sent by the webhook) is the other half: this browser is
// covered by the cookie, the email covers every other device.
import Stripe from 'stripe';
import { sign, peek, expiryFrom, setAccessCookie, readToken } from '../lib/token.js';
import { redirect, methodGuard } from '../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;

  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');

  const sessionId = String(req.query.cs || '').trim();
  const next = String(req.query.next || '').replace(/[^a-z0-9-]/gi, '').slice(0, 80);
  const onward = next ? `/go/${next}` : '/unlock.html?welcome=1';

  if (!sessionId.startsWith('cs_')) return redirect(res, '/unlock.html?error=session');

  let email;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const cs = await stripe.checkout.sessions.retrieve(sessionId);
    if (cs?.payment_status !== 'paid') return redirect(res, '/unlock.html?error=unpaid');
    email = (cs.customer_details?.email || cs.customer_email || '').trim().toLowerCase();
  } catch (err) {
    console.error('activate: stripe lookup failed', err.message);
    return redirect(res, '/unlock.html?error=stripe');
  }

  if (!email) {
    console.error('activate: paid session with no email', sessionId);
    return redirect(res, '/unlock.html?error=noemail');
  }

  // If this browser already holds unexpired access for the same person, add to
  // it rather than replacing it — matching what the webhook does.
  let from = null;
  try {
    const current = await peek(readToken(req));
    if (current && current.email === email && current.expiresAt > new Date()) from = current.expiresAt;
  } catch { /* no usable cookie; start from now */ }

  try {
    const expiresAt = expiryFrom(from);
    setAccessCookie(res, await sign(email, expiresAt));
  } catch (err) {
    console.error('activate: cannot mint token', err.message);
    return redirect(res, '/unlock.html?error=config');
  }

  // `next` is stripped to a bare slug above, so this is always same-origin and
  // can never be pointed at another site.
  return redirect(res, onward);
}
