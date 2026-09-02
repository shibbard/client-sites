import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { admin } from './supabase.js';

export const COOKIE = 'hfh_session';
const SESSION_DAYS = 60;       // outlives a 30-day access window, so renewing does not mean signing in again
const MAX_DEVICES = 3;
const THROTTLE_WINDOW_MIN = 10;
const THROTTLE_MAX_EVENTS = 25;

const sha256 = s => createHash('sha256').update(s).digest('hex');

export const parseCookies = req => {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
};

export const setSessionCookie = (res, token) => {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader('Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`);
};

export const clearSessionCookie = res => {
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
};

// Coarse label so a member can recognise their own devices; not a fingerprint.
export const deviceLabel = req => {
  const ua = req.headers['user-agent'] || '';
  const os = /iPhone|iPad/i.test(ua) ? 'iOS'
    : /Android/i.test(ua) ? 'Android'
    : /Mac OS X/i.test(ua) ? 'Mac'
    : /Windows/i.test(ua) ? 'Windows'
    : /Linux/i.test(ua) ? 'Linux' : 'Device';
  const br = /Edg\//i.test(ua) ? 'Edge'
    : /OPR\//i.test(ua) ? 'Opera'
    : /Chrome\//i.test(ua) ? 'Chrome'
    : /Safari\//i.test(ua) ? 'Safari'
    : /Firefox\//i.test(ua) ? 'Firefox' : 'Browser';
  return `${br} on ${os}`;
};

export const createSession = async (memberId, req) => {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  const { error } = await admin.from('sessions').insert({
    member_id: memberId,
    token_hash: sha256(token),
    device_label: deviceLabel(req),
    expires_at: expiresAt,
  });
  if (error) throw new Error(`session insert failed: ${error.message}`);
  // The DB trigger evicts the oldest beyond MAX_DEVICES; belt and braces here
  // so the cap still holds if the trigger is ever missing from an environment.
  const { data: extra } = await admin.from('sessions')
    .select('id').eq('member_id', memberId)
    .order('created_at', { ascending: false }).range(MAX_DEVICES, 999);
  if (extra?.length) {
    await admin.from('sessions').delete().in('id', extra.map(r => r.id));
  }
  return token;
};

// Resolves the cookie to a member, or null. This is the gate: it runs on the
// server before any owner URL is put in a response.
export const getMember = async req => {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;

  const { data: session } = await admin
    .from('sessions')
    .select('id, member_id, expires_at, members ( id, email, access_expires_at )')
    .eq('token_hash', sha256(token))
    .maybeSingle();

  if (!session || !session.members) return null;
  if (new Date(session.expires_at) < new Date()) {
    await admin.from('sessions').delete().eq('id', session.id);
    return null;
  }

  return {
    sessionId: session.id,
    id: session.members.id,
    email: session.members.email,
    accessExpiresAt: session.members.access_expires_at,
    hasAccess: !!session.members.access_expires_at
      && new Date(session.members.access_expires_at) > new Date(),
  };
};

export const touchSession = sessionId =>
  admin.from('sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', sessionId);

// A real browser cannot click this fast; a scraper cannot avoid it.
export const isThrottled = async memberId => {
  const since = new Date(Date.now() - THROTTLE_WINDOW_MIN * 60000).toISOString();
  const { count } = await admin.from('link_events')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId).gte('created_at', since);
  return (count || 0) >= THROTTLE_MAX_EVENTS;
};

export const ACCESS_DAYS = 30;
export { MAX_DEVICES, THROTTLE_MAX_EVENTS, THROTTLE_WINDOW_MIN };
