// Local preview only. Serves the static site and stubs the API responses so the
// unlock panel can be checked visually without Stripe or Supabase credentials.
// Not used in production — Vercel serves api/ for real.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const root = process.cwd();

// Flip these to preview the other states.
const STUB = {
  signedIn: process.env.STUB_SIGNED_IN === '1',
  hasAccess: process.env.STUB_HAS_ACCESS === '1',
  email: 'someone@example.com',
  accessExpiresAt: new Date(Date.now() + 30 * 864e5).toISOString(),
};

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
