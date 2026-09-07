// "Email me a code."
//
// A code goes out whether or not the address has ever paid, and the reply is
// the same either way. Checking Stripe here would turn this endpoint into a way
// to ask "is this person a customer?" — the check belongs after the code has
// been proved, in verify-code.
import { json, readJson, methodGuard, siteUrl, clientIp } from '../../lib/http.js';
import { canSend, issueCode, isEmail, normaliseEmail } from '../../lib/otp.js';
import { sendSignInCode } from '../../lib/email.js';

// Same words on every path that is not a malformed address, so nothing here
// distinguishes "sent" from "rate limited" from "not a customer".
const SAME_ANSWER = {
  ok: true,
  message: 'If that address can be reached, a six-digit code is on its way. It can take a minute — check spam too.',
};

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;

  const body = await readJson(req);
  const email = normaliseEmail(body.email);
  if (!isEmail(email)) return json(res, 400, { error: 'invalid_email' });

  try {
    if (!(await canSend(email, clientIp(req)))) {
      res.setHeader('Retry-After', '900');
      return json(res, 429, SAME_ANSWER);
    }

    const code = await issueCode(email);
    await sendSignInCode({ to: email, code, siteUrl: siteUrl(req) });
  } catch (err) {
    // Logged, not surfaced. A failure here must not tell the caller anything
    // about the address — and a customer who is stuck can still email Gary.
    console.error('send-code:', err.message);
  }

  return json(res, 200, SAME_ANSWER);
}
