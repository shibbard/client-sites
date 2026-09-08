// "Here is the code."
//
// Proving the inbox and having access are two different things, and they are
// decided in that order. The code proves the person is at that address; Stripe
// then says how long, if at all, that address has paid for. Somebody who has
// never bought can pass the first step and still be shown the buy panel.
import Stripe from 'stripe';
import { checkCode, isEmail, normaliseEmail, MAX_ATTEMPTS } from '../../lib/otp.js';
import { accessEndFor } from '../../lib/stripe-access.js';
import { sign, setAccessCookie } from '../../lib/token.js';
import { json, readJson, methodGuard } from '../../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;

  const body = await readJson(req);
  const email = normaliseEmail(body.email);
  const code = String(body.code || '').replace(/\D/g, '');

  if (!isEmail(email) || code.length !== 6) return json(res, 400, { error: 'invalid_input' });

  let outcome;
  try {
    outcome = await checkCode(email, code);
  } catch (err) {
    console.error('verify-code: store unavailable', err.message);
    return json(res, 503, { error: 'unavailable', message: 'We could not check that code just now. Please try again in a moment.' });
  }

  if (outcome === 'locked') {
    return json(res, 429, {
      error: 'locked',
      message: `That is ${MAX_ATTEMPTS} wrong attempts, so that code is now dead. Ask for a new one.`,
    });
  }
  if (outcome !== 'ok') {
    return json(res, 401, { error: 'bad_code', message: 'That code was not right, or it has expired.' });
  }

  // The inbox is proved. Now: has this address paid, and for how long?
  let accessEnd = null;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    accessEnd = await accessEndFor(stripe, email);
  } catch (err) {
    console.error('verify-code: stripe lookup failed', err.message);
    return json(res, 503, { error: 'unavailable', message: 'We could not reach Stripe to check your access. Please try again in a moment.' });
  }

  if (!accessEnd) {
    return json(res, 200, { ok: true, email, hasAccess: false, known: false });
  }

  // The cookie is set even when the window has closed: an expired token grants
  // nothing at the gate, but it lets the panel say "your access ran out on the
  // 3rd" rather than showing a first-time visitor's blank paywall.
  try {
    setAccessCookie(res, await sign(email, accessEnd), accessEnd);
  } catch (err) {
    console.error('verify-code: cannot mint token', err.message);
    return json(res, 500, { error: 'server_error' });
  }

  return json(res, 200, {
    ok: true,
    email,
    hasAccess: accessEnd > new Date(),
    known: true,
    accessExpiresAt: accessEnd.toISOString(),
  });
}
