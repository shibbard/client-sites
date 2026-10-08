import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import Stripe from 'stripe';
import { reportPaymentIssue, handlePaymentFailure } from '../lib/payment-alerts.js';
import webhook from '../api/stripe-webhook.js';
import checkout from '../api/checkout.js';

process.env.PAYMENT_ALERT_TO = 'operator@example.com';
process.env.RESEND_API_KEY = 'test-resend';
process.env.MAIL_FROM = 'HFH <mail@example.com>';
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-redis';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.SITE_URL = 'https://hfhtravel.com';
process.env.VERCEL_ENV = 'production';
const realFetch = globalThis.fetch;
const store = new Map();
const mail = [];
let mailFails = false;
let redisFails = false;
globalThis.fetch = async (url, options) => {
  if (url === 'https://redis.example.com') {
    if (redisFails) throw new Error('redis unavailable');
    const [command, key, value, ...flags] = JSON.parse(options.body);
    let result = null;
    if (command === 'GET') result = store.get(key) ?? null;
    if (command === 'SET') {
      if (!flags.includes('NX') || !store.has(key)) { store.set(key, value); result = 'OK'; }
    }
    if (command === 'DEL') { result = store.delete(key) ? 1 : 0; }
    return new Response(JSON.stringify({ result }));
  }
  assert.equal(url, 'https://api.resend.com/emails', 'unexpected outbound request');
  if (mailFails) return new Response('unavailable', { status: 503 });
  mail.push({ ...JSON.parse(options.body), headers: options.headers });
  return new Response(JSON.stringify({ id: 'mock_email' }));
};

try {
  const issue = { kind: 'payment_failed', reference: 'evt_failure', paymentId: 'pi_safe123',
    code: 'insufficient_funds', amount: 595, currency: 'gbp', strict: true };
  assert.equal(await reportPaymentIssue(issue), true);
  assert.match(mail[0].text, /5.95 GBP/);
  assert.match(mail[0].text, /insufficient_funds/);
  assert.deepEqual(mail[0].to, ['operator@example.com']);
  await reportPaymentIssue(issue);
  assert.equal(mail.length, 1, 'duplicate Stripe event should not send twice');
  console.log('ok: safe payment details and duplicate suppression');

  await reportPaymentIssue({ kind: 'checkout_failed', code: 'sk_live_private', paymentId: 'cs_live_access_secret' });
  assert.ok(!mail.at(-1).text.includes('sk_live_'));
  assert.ok(!mail.at(-1).text.includes('cs_live_'));
  console.log('ok: raw secrets and access-session IDs cannot enter alerts');

  mailFails = true;
  await assert.rejects(reportPaymentIssue({ ...issue, reference: 'evt_retry' }));
  mailFails = false;
  await reportPaymentIssue({ ...issue, reference: 'evt_retry' });
  assert.equal(mail.length, 3);
  console.log('ok: failed email releases claim so Stripe can retry');

  redisFails = true;
  await reportPaymentIssue({ ...issue, reference: 'evt_redis_down' });
  redisFails = false;
  assert.equal(mail.length, 4);
  console.log('ok: deduplication outage does not suppress alerts');

  process.env.VERCEL_ENV = 'preview';
  assert.equal(await reportPaymentIssue({ ...issue, reference: 'evt_preview' }), false);
  assert.equal(mail.length, 4);
  process.env.VERCEL_ENV = 'production';
  console.log('ok: previews cannot notify live operators');

  const otherStripe = { checkout: { sessions: { list: async () => ({ data: [{ success_url: 'https://other.example.com/success' }] }) } } };
  await handlePaymentFailure(otherStripe, { id: 'evt_unrelated', type: 'payment_intent.payment_failed', data: { object: { id: 'pi_other' } } });
  assert.equal(mail.length, 4);
  const failure = { id: 'evt_hfh', type: 'payment_intent.payment_failed', data: { object: {
    id: 'pi_hfh123', metadata: { hfh_product: 'directory_access' }, amount: 595, currency: 'gbp',
    last_payment_error: { code: 'card_declined', message: 'private customer details' },
  } } };
  await handlePaymentFailure({}, failure);
  assert.equal(mail.length, 5);
  assert.ok(!mail.at(-1).text.includes('private customer details'));
  console.log('ok: HFH failures notify, unrelated account products do not');

  await handlePaymentFailure({}, { id: 'evt_delayed', type: 'checkout.session.async_payment_failed', data: { object: {
    success_url: 'https://hfhtravel.com/api/activate?cs=cs_secret', payment_intent: 'pi_delayed123', amount_total: 595, currency: 'gbp',
  } } });
  assert.equal(mail.length, 6);
  console.log('ok: delayed-payment failures notify');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const runWebhook = async (event, valid = true) => {
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: valid ? 'whsec_test' : 'whsec_wrong' });
    const req = Readable.from([Buffer.from(payload)]);
    req.method = 'POST'; req.headers = { 'stripe-signature': signature };
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, setHeader() { return this; }, end(s) { this.body = s; } };
    await webhook(req, res);
    return res;
  };
  assert.equal((await runWebhook({ ...failure, id: 'evt_signed' })).statusCode, 200);
  assert.equal(mail.length, 7);
  assert.equal((await runWebhook({ ...failure, id: 'evt_invalid' }, false)).statusCode, 400);
  assert.equal(mail.length, 7, 'invalid webhook must never alert');
  mailFails = true;
  assert.equal((await runWebhook({ ...failure, id: 'evt_signed_retry' })).statusCode, 500);
  mailFails = false;
  assert.equal((await runWebhook({ ...failure, id: 'evt_signed_retry' })).statusCode, 200);
  console.log('ok: signature enforcement and webhook retry on alert failure');

  const noEmail = { id: 'evt_noemail', type: 'checkout.session.completed', data: { object: {
    id: 'cs_live_secret', payment_status: 'paid', payment_intent: 'pi_noemail123',
  } } };
  assert.equal((await runWebhook(noEmail)).statusCode, 200);
  assert.match(mail.at(-1).subject, /no email/);
  assert.ok(!mail.at(-1).text.includes('cs_live_secret'));
  const beforeTestEvent = mail.length;
  await runWebhook({ ...failure, id: 'evt_testmode', livemode: false });
  assert.equal(mail.length, beforeTestEvent);
  console.log('ok: missing paid email alerts safely; test-mode events do not notify production');

  const diagnostic = { id: 'evt_diagnostic', type: 'hfh.integration.alert_test', data: { object: {} } };
  assert.equal((await runWebhook(diagnostic)).statusCode, 200);
  assert.match(mail.at(-1).subject, /TEST/);
  assert.match(mail.at(-1).text, /No payment was made/);
  const afterDiagnostic = mail.length;
  assert.equal((await runWebhook({ ...diagnostic, id: 'evt_unsigned_diagnostic' }, false)).statusCode, 400);
  assert.equal(mail.length, afterDiagnostic);
  console.log('ok: live diagnostic requires a valid signature and cannot grant access');

  delete process.env.STRIPE_SECRET_KEY;
  const checkoutRes = { statusCode: 200, status(n) { this.statusCode = n; return this; }, setHeader() { return this; }, end(s) { this.body = s; } };
  await checkout({ method: 'POST', body: {}, headers: {} }, checkoutRes);
  assert.equal(checkoutRes.statusCode, 500);
  assert.equal(JSON.parse(checkoutRes.body).error, 'checkout_failed');
  assert.match(mail.at(-1).subject, /Checkout could not start/);
  console.log('ok: checkout setup failure alerts and preserves the visitor error response');
} finally {
  globalThis.fetch = realFetch;
}
