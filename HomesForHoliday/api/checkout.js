import Stripe from 'stripe';
import { json, readJson, methodGuard, siteUrl } from '../lib/http.js';

// £5.95 flat. VLA Media Ltd is not VAT registered, so this is the whole price.
// If that ever changes, the registered price has to be VAT-inclusive at this
// number rather than added on top, and terms.html says so too.
const PRICE_PENCE = 595;
const CURRENCY = 'gbp';

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
      // No payment_method_types on purpose. Naming them here pins the list to
      // whatever was hardcoded and stops Stripe offering anything else — the
      // wallets included. Left off, Checkout shows every method enabled in the
      // dashboard that suits the buyer's device and the £5.95 GBP amount, so
      // Apple Pay and Google Pay appear where they are supported and turning a
      // new method on later is a dashboard toggle rather than a deploy.
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
      // Creates a Customer against the email even in payment mode. With no
      // database of our own, that record is what /api/recover reads to work out
      // who paid and when.
      customer_creation: 'always',
      // Back through /api/activate, which confirms the payment with Stripe and
      // sets the cookie, so access is immediate rather than waiting on email.
      success_url: `${base}/api/activate?cs={CHECKOUT_SESSION_ID}${next ? `&next=${next}` : ''}`,
      cancel_url: `${base}/unlock.html${next ? `?next=${next}` : ''}`,
      metadata: { next_slug: next || '' },
    });

    return json(res, 200, { url: session.url });
  } catch (err) {
    console.error('checkout', err.message);
    return json(res, 500, { error: 'checkout_failed' });
  }
}
