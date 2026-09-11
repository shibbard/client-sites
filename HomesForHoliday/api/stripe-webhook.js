// Stripe is the source of truth for payment, and the signed webhook — not the
// browser redirect — is what triggers the confirmation email.
//
// The buyer already has access by this point: /api/activate set their cookie on
// the way back from Stripe. What this adds is the receipt, and the reminder
// that other devices sign in with a code rather than a shared link.
import Stripe from 'stripe';
import { foldAccessEnd, paidSessionsFor } from '../lib/stripe-access.js';
import { sendAccessNotice } from '../lib/email.js';
import { readRawBody, json, siteUrl, checkoutOrigin } from '../lib/http.js';

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

    // Replay every payment this address has made, including this one, so the
    // date quoted in the email is the same one a later sign-in will compute.
    // Buying twice stacks: the new window starts where the old one ended.
    let sessions = [cs];
    try {
      const known = await paidSessionsFor(stripe, email);
      sessions = [cs, ...known.filter(prev => prev.id !== cs.id)];
    } catch (err) {
      // Not worth failing the webhook over — they still get a full 30 days, and
      // the sign-in path recomputes from Stripe anyway.
      console.error('webhook: could not check earlier purchases', err.message);
    }

    const expiresAt = foldAccessEnd(sessions);
    const renewed = sessions.length > 1;

    // Link the email to the site they bought on. Without this, a purchase on the
    // real domain whose event reached the test preview's webhook emailed out
    // links to the preview.
    const site = process.env.SITE_URL || checkoutOrigin(cs) || siteUrl(req);

    try {
      await sendAccessNotice({ to: email, expiresAt, siteUrl: site, renewed });
      console.log(`webhook: notice sent to ${email}, access until ${expiresAt.toISOString()}`);
    } catch (err) {
      // 500 makes Stripe retry. The buyer is not locked out either way — they
      // are already through on this device, and a code gets them in on another.
      console.error('webhook: could not send the confirmation', err.message);
      res.statusCode = 500;
      return res.end('send failed');
    }
  }

  return json(res, 200, { received: true });
}
