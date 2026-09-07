// Local preview only. Serves the static site and stubs the API responses so the
// unlock panel can be checked visually without Stripe or Resend credentials.
// Not used in production — Vercel serves api/ for real.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const root = process.cwd();

// Flip these to preview the other states.
// STUB_STATE=locked | active | lapsed
const STATE = process.env.STUB_STATE || 'locked';
const STUB = {
  locked:  { hasAccess: false, known: false },
  active:  { hasAccess: true,  known: true, email: 'someone@example.com',
             accessExpiresAt: new Date(Date.now() + 30 * 864e5).toISOString() },
  lapsed:  { hasAccess: false, known: true, lapsed: true, email: 'someone@example.com',
             accessExpiresAt: new Date(Date.now() - 2 * 864e5).toISOString() },
}[STATE] || { hasAccess: false, known: false };

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.jfif': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let path = decodeURIComponent(url.pathname);

  if (path === '/api/me') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(STUB));
  }
  // Stubbed sign-in, so the panels can be walked through with no Redis, Stripe
  // or Resend. Any six digits are accepted; STUB_STATE decides what comes back.
  if (path === '/api/auth/send-code') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, message: 'Stub: any six digits will do.' }));
  }
  if (path === '/api/auth/verify-code') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      email: STUB.email || 'someone@example.com',
      known: STATE !== 'locked',
      hasAccess: STATE === 'active',
      accessExpiresAt: STUB.accessExpiresAt,
    }));
  }
  if (path.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, stub: true }));
  }
  // Mirrors the vercel.json rewrite: unauthenticated, so straight to the panel.
  if (path.startsWith('/go/')) {
    res.writeHead(302, { Location: `/unlock.html?next=${path.slice(4)}`, 'Cache-Control': 'no-store' });
    return res.end();
  }

  if (path === '/') path = '/index.html';
  const file = join(root, normalize(path).replace(/^(\.\.[/\\])+/, ''));

  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT, () => console.log(`preview → http://localhost:${PORT}`));
