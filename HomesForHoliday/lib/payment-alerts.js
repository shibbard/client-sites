import { createHash } from 'node:crypto';
import { get, setEx, setIfAbsent, del } from './redis.js';
import { sendPaymentAlert } from './email.js';

const ISSUES = {
  alert_test: ['TEST — payment alerts enabled', 'This is a diagnostic test. No payment was made and no customer has had an error.'],
  payment_failed: ['Payment attempt failed', 'The buyer may retry successfully. Check Stripe before contacting them.'],
  delayed_payment_failed: ['Delayed payment failed', 'Stripe reports that a delayed payment failed. Access has not been granted for this payment.'],
  checkout_failed: ['Checkout could not start', 'A visitor could not open Stripe checkout. Check the Stripe configuration and Vercel logs.'],
  activation_failed: ['Paid access could not be activated', 'Check the payment in Stripe and the Vercel logs. Do not ask the buyer to pay again.'],
  activation_lookup_failed: ['Payment verification failed', 'The site could not verify a checkout with Stripe. Check Stripe and the Vercel logs.'],
  confirmation_failed: ['Paid confirmation could not be sent', 'Stripe will retry the webhook. The buyer can still sign in to paid access.'],
  paid_email_missing: ['Paid checkout has no email', 'Check the paid checkout in Stripe. The buyer needs an email address to sign in.'],
};

// Only short provider codes are allowed. Never email raw exceptions, secrets,
// card details, customer email addresses or access-granting session IDs.
const codeOnly = value => /^[a-z][a-z0-9_]{0,79}$/i.test(String(value || ''))
  && !/^(sk_|pk_|whsec_|cs_|re_)/i.test(String(value)) ? String(value) : 'unknown';
export const paymentReference = value => /^pi_[a-z0-9]+$/i.test(String(value || '')) ? String(value) : '';

export const alertRecipients = () => [...new Set((process.env.PAYMENT_ALERT_TO || '')
  .split(',').map(s => s.trim()).filter(s => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(s)))];

export async function reportPaymentIssue({ kind, reference = '', paymentId = '', code, amount, currency, strict = false }) {
  const issue = ISSUES[kind];
  const to = alertRecipients();
  if (!issue || !to.length || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')) return false;

  // Distinct Stripe failures are remembered for seven days. Public endpoint
  // errors are grouped by kind/code for ten minutes to avoid an inbox flood.
  const errorCode = codeOnly(code);
  const identity = `${kind}:${reference || errorCode}`;
  const digest = createHash('sha256').update(identity).digest('hex');
  const key = `hfh:payment-alert:${digest}`;
  const ttl = reference ? 7 * 86400 : 600;
  let claimed = false;
  try {
    let storeAvailable = true;
    try {
      if (await get(key) === 'sent') return true;
      claimed = await setIfAbsent(`${key}:lock`, '1', 30) === 'OK';
    } catch {
      // A Redis outage must not prevent the email; Resend also deduplicates.
      storeAvailable = false;
      console.error('payment alert deduplication store unavailable');
    }
    if (storeAvailable && !claimed) {
      if (strict) throw new Error('alert_busy');
      return false;
    }
    const pi = paymentReference(paymentId);
    const amountLine = Number.isSafeInteger(amount) && /^[a-z]{3}$/i.test(currency || '')
      ? `Amount: ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}` : '';
    const text = [
      `HFH alert: ${issue[0]}`,
      `Site: https://hfhtravel.com`, `Code: ${errorCode}`, amountLine,
      pi ? `Stripe payment: ${pi}\nhttps://dashboard.stripe.com/payments/${pi}` : '',
      '', issue[1], '',
      'This is an operational alert. It contains no customer or card details.',
    ].filter(Boolean).join('\n');
    await sendPaymentAlert({ to, subject: `HFH payment alert — ${issue[0]}`, text,
      idempotencyKey: `hfh-alert-${digest}-${Math.floor(Date.now() / ((reference ? 86400 : 600) * 1000))}` });
    await setEx(key, 'sent', ttl).catch(() => console.error('payment alert sent but deduplication unavailable'));
    return true;
  } catch (err) {
    console.error('payment alert delivery failed', kind, err.name);
    if (strict) throw err;
    return false;
  } finally {
    if (claimed) await del(`${key}:lock`).catch(() => {});
  }
}

export const isHfhCheckout = cs => {
  try {
    const origin = new URL(cs.success_url).origin;
    return [process.env.SITE_URL, 'https://hfhtravel.com', 'https://home-for-holiday.getdigitaldone.co.uk'].includes(origin);
  } catch { return false; }
};

export async function handlePaymentFailure(stripe, event) {
  if (!['payment_intent.payment_failed', 'checkout.session.async_payment_failed'].includes(event.type)) return false;
  if (event.livemode === false && process.env.VERCEL_ENV === 'production') return true;
  const object = event.data.object;
  if (event.type === 'payment_intent.payment_failed') {
    // Metadata marks new HFH sessions. The lookup covers checkouts opened
    // before this deploy and excludes other products in Gary's account.
    if (object.metadata?.hfh_product !== 'directory_access') {
      const sessions = await stripe.checkout.sessions.list({ payment_intent: object.id, limit: 1 });
      if (!sessions.data.some(isHfhCheckout)) return true;
    }
    await reportPaymentIssue({ kind: 'payment_failed', reference: event.id, paymentId: object.id,
      code: object.last_payment_error?.decline_code || object.last_payment_error?.code,
      amount: object.amount, currency: object.currency, strict: true });
  } else if (isHfhCheckout(object)) {
    await reportPaymentIssue({ kind: 'delayed_payment_failed', reference: event.id,
      paymentId: object.payment_intent, code: 'async_payment_failed',
      amount: object.amount_total, currency: object.currency, strict: true });
  }
  return true;
}
