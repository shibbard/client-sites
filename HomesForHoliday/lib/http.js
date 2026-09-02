export const json = (res, status, body) => {
  res.status(status)
     .setHeader('Content-Type', 'application/json')
     .setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

// Gate responses must never be cached: a shared or CDN cache holding a 302 to
// an owner site would serve it to people who never paid.
export const redirect = (res, location, { store = false } = {}) => {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', store ? 'private, max-age=0' : 'no-store, private');
  res.end();
};

export const methodGuard = (req, res, allowed) => {
  if (allowed.includes(req.method)) return true;
  res.setHeader('Allow', allowed.join(', '));
  json(res, 405, { error: 'method_not_allowed' });
  return false;
};

export const readRawBody = req => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', c => chunks.push(Buffer.from(c)));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

export const readJson = async req => {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); } catch { return {}; }
};

export const clientIp = req =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
