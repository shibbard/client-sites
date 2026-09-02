import Stripe from 'stripe';
import { json, readJson, methodGuard } from '../lib/http.js';

const PRICE_PENCE = 595;          // £5.95 — see note in README about VAT
const CURRENCY = 'gbp';

const siteUrl = req => process.env.SITE_URL
  || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;

  const body = await readJson(req);
  // Only ever a slug from our own data — used to send them back where they were.
  const next = String(body.next || '').replace(/[^a-z0-9-]/gi, '').slice(0, 80);
  const base = siteUrl(req);

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: PRICE_PENCE,
          product_data: {
            name: 'Home for Holiday — 30 day directory access',
            description: 'Direct links to every owner’s own website, for 30 days.',
          },
        },
      }],
      // Consumer contract regs: instant digital access means the buyer must
      // agree to start now and give up the 14-day cancellation right.
      consent_collection: { terms_of_service: 'required' },
      custom_text: {
        terms_of_service_acceptance: {
          message: 'I agree to the [Terms](' + base + '/terms.html) and I want access immediately. I understand I lose my 14-day right to cancel once access begins.',
        },
      },
      allow_promotion_codes: false,
      success_url: `${base}/unlock.html?paid=1&cs={CHECKOUT_SESSION_ID}${next ? `&next=${next}` : ''}`,
      cancel_url: `${base}/unlock.html${next ? `?next=${next}` : ''}`,
      metadata: { next_slug: next || '' },
    });

    return json(res, 200, { url: session.url });
  } catch (err) {
    console.error('checkout', err.message);
    return json(res, 500, { error: 'checkout_failed' });
  }
}
