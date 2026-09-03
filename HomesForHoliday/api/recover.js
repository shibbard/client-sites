// "Send me my link again."
//
// With no database, the obvious worry is that losing the email means losing
// what you paid for. It doesn't: Stripe already knows who paid and when, so it
// serves as the record. We look the buyer up there, work out how much of their
// 30 days is left, mint a fresh token and email it.
//
// The reply is deliberately the same whether or not the address bought
// anything — this endpoint must not become a way to test which addresses are
// customers.
import Stripe from 'stripe';
import { sign, ACCESS_DAYS } from '../lib/token.js';
import { sendAccessLink } from '../lib/email.js';
import { isThrottled } from '../lib/throttle.js';
import { json, readJson, methodGuard, siteUrl, clientIp } from '../lib/http.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAME_ANSWER = {
  ok: true,
  message: 'If that address has access, the link is on its way. It can take a minute — check spam too.',
};

// The most recent paid checkout for this address, or null.
const findLastPayment = async (stripe, email) => {
  const { data: customers } = await stripe.customers.list({ email, limit: 10 });
  let latest = null;

  for (const customer of customers) {
    const { data: sessions } = await stripe.checkout.sessions.list({ customer: customer.id, limit: 20 });
    for (const cs of sessions) {
      if (cs.payment_status !== 'paid') continue;
      if (!latest || cs.created > latest.created) latest = cs;
    }
  }
  return latest;
};

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;

  const body = await readJson(req);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) return json(res, 400, { error: 'invalid_email' });

  // Sending email costs money and annoys people; cap the obvious abuse.
  if (isThrottled(`recover:${clientIp(req)}`)) {
    res.setHeader('Retry-After', '600');
    return json(res, 429, SAME_ANSWER);
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const payment = await findLastPayment(stripe, email);
    if (!payment) return json(res, 200, SAME_ANSWER);

    // Their window runs 30 days from the payment, not from today — re-sending
    // the link must not quietly extend what they bought.
    const paidAt = new Date(payment.created * 1000);
    const expiresAt = new Date(paidAt.getTime() + ACCESS_DAYS * 864e5);
    if (expiresAt <= new Date()) return json(res, 200, SAME_ANSWER);

    await sendAccessLink({
      to: email,
      token: await sign(email, expiresAt),
      expiresAt,
      siteUrl: siteUrl(req),
    });
  } catch (err) {
    // Still the same answer to the browser: a failure here must not reveal
    // whether the address exists.
    console.error('recover:', err.message);
  }

  return json(res, 200, SAME_ANSWER);
}
