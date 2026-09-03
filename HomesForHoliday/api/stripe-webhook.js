// Stripe is the source of truth for payment, and the signed webhook — not the
// browser redirect — is what triggers the email.
//
// The buyer already has access by this point: /api/activate set their cookie on
// the way back from Stripe. What this adds is the link that works on any other
// device, and is the way back in if they clear their browser.
import Stripe from 'stripe';
import { sign, expiryFrom, ACCESS_DAYS } from '../lib/token.js';
import { sendAccessLink } from '../lib/email.js';
import { readRawBody, json, siteUrl } from '../lib/http.js';

// Signature verification needs the untouched bytes.
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('webhook: bad signature', err.message);
    res.statusCode = 400;
    return res.end(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const cs = event.data.object;

    if (cs.payment_status !== 'paid') {
      return json(res, 200, { received: true, ignored: 'not_paid' });
    }

    const email = (cs.customer_details?.email || cs.customer_email || '').trim().toLowerCase();
    if (!email) {
      console.error('webhook: paid session with no email', cs.id);
      return json(res, 200, { received: true, ignored: 'no_email' });
    }

    // Buying twice adds to whatever is left. Without a table to read, "what is
    // left" comes from Stripe: if there is an earlier paid checkout still
    // inside its 30 days, the new window starts from the end of that one.
    let from = null;
    try {
      if (typeof cs.customer === 'string') {
        const { data: earlier } = await stripe.checkout.sessions.list({ customer: cs.customer, limit: 20 });
        for (const prev of earlier) {
          if (prev.id === cs.id || prev.payment_status !== 'paid') continue;
          const ends = new Date(prev.created * 1000 + ACCESS_DAYS * 864e5);
          if (ends > new Date() && (!from || ends > from)) from = ends;
        }
      }
    } catch (err) {
      // Not worth failing the webhook over — they still get a full 30 days.
      console.error('webhook: could not check earlier purchases', err.message);
    }

    try {
      const expiresAt = expiryFrom(from);
      const token = await sign(email, expiresAt);
      await sendAccessLink({ to: email, token, expiresAt, siteUrl: siteUrl(req), renewed: !!from });
      console.log(`webhook: link sent to ${email}, access until ${expiresAt.toISOString()}`);
    } catch (err) {
      // 500 makes Stripe retry. Worth retrying: the email is how they get back
      // in on any device other than the one they paid on.
      console.error('webhook: could not send the access link', err.message);
      res.statusCode = 500;
      return res.end('send failed');
    }
  }

  return json(res, 200, { received: true });
}
