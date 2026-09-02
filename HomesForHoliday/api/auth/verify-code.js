// Verifies the 6-digit code and issues the session cookie.
import { admin, authClient } from '../../lib/supabase.js';
import { createSession, setSessionCookie } from '../../lib/session.js';
import { json, readJson, methodGuard } from '../../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;

  const body = await readJson(req);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const token = String(body.code || '').replace(/\D/g, '');

  if (!email || token.length !== 6) return json(res, 400, { error: 'invalid_input' });

  const { data, error } = await authClient.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data?.user) {
    return json(res, 401, { error: 'bad_code', message: 'That code was not right, or it has expired.' });
  }

  // Find or create the member row. A member can exist without access — paying
  // is what sets access_expires_at, via the Stripe webhook.
  let { data: member } = await admin
    .from('members').select('id, email, access_expires_at').eq('email', email).maybeSingle();

  if (!member) {
    const { data: created, error: insErr } = await admin
      .from('members').insert({ email }).select('id, email, access_expires_at').single();
    if (insErr) {
      console.error('verify-code: member insert', insErr.message);
      return json(res, 500, { error: 'server_error' });
    }
    member = created;
  }

  try {
    const sessionToken = await createSession(member.id, req);
    setSessionCookie(res, sessionToken);
  } catch (err) {
    console.error('verify-code: session', err.message);
    return json(res, 500, { error: 'server_error' });
  }

  const hasAccess = !!member.access_expires_at && new Date(member.access_expires_at) > new Date();
  return json(res, 200, {
    ok: true,
    email: member.email,
    hasAccess,
    accessExpiresAt: member.access_expires_at,
  });
}
