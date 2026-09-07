// Instant access, straight back from Stripe.
//
// Stripe's redirect lands here with the checkout session id. We ask Stripe
// whether it was actually paid — the id alone proves nothing — then mint the
// token and set the cookie, so a buyer is through to the property they wanted
// without going via their inbox at all.
//
// The expiry is folded from Stripe's own payment history rather than from the
// cookie, so it agrees exactly with what signing in on another device will
// work out later.
import Stripe from 'stripe';
import { foldAccessEnd, paidSessionsFor } from '../lib/stripe-access.js';
import { sign, setAccessCookie } from '../lib/token.js';
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
  let expiresAt;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const cs = await stripe.checkout.sessions.retrieve(sessionId);
    if (cs?.payment_status !== 'paid') return redirect(res, '/unlock.html?error=unpaid');

    email = (cs.customer_details?.email || cs.customer_email || '').trim().toLowerCase();
    if (!email) {
      console.error('activate: paid session with no email', sessionId);
      return redirect(res, '/unlock.html?error=noemail');
    }

    // This session plus anything bought earlier, so a repeat purchase stacks
    // rather than resets.
    const known = await paidSessionsFor(stripe, email).catch(err => {
      console.error('activate: could not list earlier purchases', err.message);
      return [];
    });
    expiresAt = foldAccessEnd([cs, ...known.filter(prev => prev.id !== cs.id)]);
  } catch (err) {
    console.error('activate: stripe lookup failed', err.message);
    return redirect(res, '/unlock.html?error=stripe');
  }

  try {
    setAccessCookie(res, await sign(email, expiresAt));
  } catch (err) {
    console.error('activate: cannot mint token', err.message);
    return redirect(res, '/unlock.html?error=config');
  }

  // `next` is stripped to a bare slug above, so this is always same-origin and
  // can never be pointed at another site.
  return redirect(res, onward);
}
