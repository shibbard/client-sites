// Stripe is the source of truth for payment. The webhook, not the browser
// redirect, is what grants access.
import Stripe from 'stripe';
import { admin } from '../lib/supabase.js';
import { readRawBody, json } from '../lib/http.js';
import { ACCESS_DAYS } from '../lib/session.js';

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

    try {
      const { data: existing } = await admin
        .from('members').select('id, access_expires_at').eq('email', email).maybeSingle();

      // Extend from whatever is later: an unexpired window, or now. Buying
      // twice adds time rather than throwing the remainder away.
      const from = existing?.access_expires_at && new Date(existing.access_expires_at) > new Date()
        ? new Date(existing.access_expires_at)
        : new Date();
      const expires = new Date(from.getTime() + ACCESS_DAYS * 864e5).toISOString();

      const { error } = await admin.from('members').upsert({
        ...(existing?.id ? { id: existing.id } : {}),
        email,
        stripe_customer_id: typeof cs.customer === 'string' ? cs.customer : null,
        access_expires_at: expires,
      }, { onConflict: 'email' });

      if (error) throw new Error(error.message);
      console.log(`webhook: access granted to ${email} until ${expires}`);
    } catch (err) {
      // 500 makes Stripe retry, which is what we want if the DB was briefly down.
      console.error('webhook: grant failed', err.message);
      res.statusCode = 500;
      return res.end('grant failed');
    }
  }

  return json(res, 200, { received: true });
}
