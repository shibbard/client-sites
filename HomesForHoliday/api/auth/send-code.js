// Sends the 6-digit code. Supabase Auth issues and verifies it — we do not
// hand-roll code generation, expiry or rate limiting.
import Stripe from 'stripe';
import { authClient } from '../../lib/supabase.js';
import { json, readJson, methodGuard } from '../../lib/http.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;

  const body = await readJson(req);
  let email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  // Straight after checkout the page holds a Stripe session id rather than an
  // email. Resolving it here means the address comes from Stripe, so the
  // endpoint cannot be used to fire codes at an address someone just typed in.
  if (!email && body.checkout_session_id) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const cs = await stripe.checkout.sessions.retrieve(String(body.checkout_session_id));
      if (cs?.payment_status === 'paid') {
        email = (cs.customer_details?.email || cs.customer_email || '').trim().toLowerCase();
      }
    } catch (err) {
      console.error('send-code: stripe lookup failed', err.message);
    }
  }

  if (!EMAIL_RE.test(email)) return json(res, 400, { error: 'invalid_email' });

  // shouldCreateUser: a code is sent whether or not they have paid yet. Access
  // is decided by access_expires_at at the gate, not by having an account.
  const { error } = await authClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    console.error('send-code: supabase', error.message);
    // Deliberately vague: do not confirm whether an address is on file.
    return json(res, 429, { error: 'send_failed', message: 'Could not send a code just now. Please try again shortly.' });
  }

  return json(res, 200, { ok: true, email });
}
