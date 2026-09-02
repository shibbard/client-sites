import { admin } from '../../lib/supabase.js';
import { getMember, clearSessionCookie } from '../../lib/session.js';
import { json, methodGuard } from '../../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const member = await getMember(req);
    if (member) await admin.from('sessions').delete().eq('id', member.sessionId);
  } catch (err) {
    console.error('signout', err.message);
  }
  clearSessionCookie(res);
  return json(res, 200, { ok: true });
}
