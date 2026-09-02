// Lets the page show the right state (signed in, lapsed, signed out) without
// ever exposing an owner URL.
import { getMember } from '../lib/session.js';
import { json, methodGuard } from '../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  try {
    const member = await getMember(req);
    if (!member) return json(res, 200, { signedIn: false, hasAccess: false });
    return json(res, 200, {
      signedIn: true,
      hasAccess: member.hasAccess,
      email: member.email,
      accessExpiresAt: member.accessExpiresAt,
    });
  } catch (err) {
    console.error('me', err.message);
    return json(res, 200, { signedIn: false, hasAccess: false });
  }
}
