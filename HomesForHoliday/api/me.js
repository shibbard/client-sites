// Lets the unlock panel show the right state without ever exposing an owner
// URL. Reads the cookie only — no lookup, nothing to be slow or down.
import { readToken, verify, peek } from '../lib/token.js';
import { json, methodGuard } from '../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;

  const token = readToken(req);
  if (!token) return json(res, 200, { hasAccess: false, known: false });

  try {
    const live = await verify(token);
    if (live) {
      return json(res, 200, {
        hasAccess: true,
        known: true,
        email: live.email,
        accessExpiresAt: live.expiresAt.toISOString(),
      });
    }

    // Correctly signed but out of date — worth saying so, rather than showing
    // the same blank "locked" panel a first-time visitor gets.
    const lapsed = await peek(token);
    if (lapsed) {
      return json(res, 200, {
        hasAccess: false,
        known: true,
        lapsed: true,
        email: lapsed.email,
        accessExpiresAt: lapsed.expiresAt.toISOString(),
      });
    }
  } catch (err) {
    console.error('me:', err.message);
  }

  return json(res, 200, { hasAccess: false, known: false });
}
