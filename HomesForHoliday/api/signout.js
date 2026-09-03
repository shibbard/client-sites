// Clears the cookie on this device. There is no server-side session to end —
// the emailed link still works, which is the point of it.
import { clearAccessCookie } from '../lib/token.js';
import { json, methodGuard } from '../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  clearAccessCookie(res);
  return json(res, 200, { ok: true });
}
