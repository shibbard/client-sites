// The access token. This is what replaces the database.
//
// A token carries the buyer's email and an expiry date, signed with
// ACCESS_SECRET. Verifying is arithmetic — recompute the signature and compare
// — so there is no session table, no lookup, and nothing to keep running
// between purchases.
//
// Web Crypto rather than node:crypto so the same helper would still work if the
// gate ever moves into Edge middleware.

const enc = new TextEncoder();

const b64urlEncode = bytes => Buffer.from(bytes).toString('base64url');
const b64urlDecode = str => Buffer.from(str, 'base64url');

let keyPromise = null;
const hmacKey = () => {
  const secret = process.env.ACCESS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ACCESS_SECRET is missing or shorter than 32 characters');
  }
  keyPromise ||= crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return keyPromise;
};

const signature = async payload => {
  const key = await hmacKey();
  return b64urlEncode(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload))));
};

// Compares in constant time so a wrong signature cannot be narrowed down by
// timing one character at a time.
const sameSignature = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const ACCESS_DAYS = 30;

export const sign = async (email, expiresAt) => {
  const payload = b64urlEncode(enc.encode(JSON.stringify({
    v: 1,
    e: String(email).trim().toLowerCase(),
    x: Math.floor(new Date(expiresAt).getTime() / 1000),
  })));
  return `${payload}.${await signature(payload)}`;
};

// Returns { email, expiresAt } for a token that is well-formed, correctly
// signed and still in date; null for anything else. Never throws on bad input —
// this runs on every gated click, including from people poking at it.
export const verify = async token => {
  if (typeof token !== 'string' || token.length > 1024) return null;
  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return null;

  const payload = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(provided)) return null;

  let expected;
  try {
    expected = await signature(payload);
  } catch (err) {
    console.error('token: cannot sign —', err.message);
    return null;
  }
  if (!sameSignature(provided, expected)) return null;

  let claims;
  try {
    claims = JSON.parse(b64urlDecode(payload).toString('utf8'));
  } catch {
    return null;
  }

  if (claims?.v !== 1 || typeof claims.e !== 'string' || typeof claims.x !== 'number') return null;
  const expiresAt = new Date(claims.x * 1000);
  if (!(expiresAt > new Date())) return null;

  return { email: claims.e, expiresAt };
};

// Read the expiry without checking it is still in the future, so the unlock
// panel can say "your access ran out on the 3rd" rather than just "locked".
export const peek = async token => {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) return null;
  try {
    const expected = await signature(payload);
    if (!sameSignature(token.slice(dot + 1), expected)) return null;
    const claims = JSON.parse(b64urlDecode(payload).toString('utf8'));
    if (claims?.v !== 1 || typeof claims.e !== 'string' || typeof claims.x !== 'number') return null;
    return { email: claims.e, expiresAt: new Date(claims.x * 1000) };
  } catch {
    return null;
  }
};

export const COOKIE = 'hfh_access';
const COOKIE_DAYS = 32;   // a couple of days past the access window, so the panel can explain the lapse

export const parseCookies = req => {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
};

// A second, deliberately readable cookie holding nothing but the expiry, so the
// header on every page can say "you are in" without an API call on every view.
// It is cosmetic: the access cookie above is HttpOnly and unreadable from
// script, and the gate checks that one. Forging this changes the wording in the
// header and nothing else.
export const HINT_COOKIE = 'hfh_until';

export const setAccessCookie = (res, token, expiresAt) => {
  const maxAge = COOKIE_DAYS * 86400;
  const cookies = [
    `${COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  ];
  if (expiresAt) {
    const seconds = Math.floor(new Date(expiresAt).getTime() / 1000);
    cookies.push(`${HINT_COOKIE}=${seconds}; Max-Age=${maxAge}; Path=/; Secure; SameSite=Lax`);
  }
  res.setHeader('Set-Cookie', cookies);
};

export const clearAccessCookie = res => {
  res.setHeader('Set-Cookie', [
    `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
    `${HINT_COOKIE}=; Max-Age=0; Path=/; Secure; SameSite=Lax`,
  ]);
};

export const readToken = req => parseCookies(req)[COOKIE] || null;
