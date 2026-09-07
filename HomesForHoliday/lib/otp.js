// The six-digit sign-in code.
//
// This is what makes access non-transferable. A token in an email is a bearer
// credential — forward the email and you hand over what you paid for. A code
// has to be typed into the browser that is signing in, within ten minutes,
// which means possession of the inbox at that moment rather than possession of
// a link forever.
//
// Redis holds only a keyed hash of the code, under a key derived from the email
// rather than the email itself, for ten minutes. A dump of the store reveals
// neither who is signing in nor what their code is.
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import * as redis from './redis.js';

export const CODE_TTL_SECONDS = 10 * 60;
export const MAX_ATTEMPTS = 5;

// How many codes one address, or one IP, can ask for per hour. Sending costs
// money and lands in somebody's inbox, so both ends are capped: the per-address
// limit stops an inbox being flooded from many IPs, the per-IP limit stops one
// machine working through a list of addresses.
const SEND_WINDOW_SECONDS = 60 * 60;
const MAX_SENDS_PER_EMAIL = 5;
const MAX_SENDS_PER_IP = 15;

// Test seam. Production always uses the Redis module above; scripts/test-gate.mjs
// swaps in an in-memory double so the suite runs with no credentials.
let store = redis;
export const useStoreForTests = impl => { store = impl || redis; };

const secret = () => {
  const s = process.env.ACCESS_SECRET;
  if (!s || s.length < 32) throw new Error('ACCESS_SECRET is missing or shorter than 32 characters');
  return s;
};

const sha256 = input => createHash('sha256').update(input).digest('hex');

// Keyed, so the stored value is useless to anyone who can read the store but
// does not have ACCESS_SECRET.
const codeHash = (email, code) => sha256(`${secret()}:${email}:${code}`);
const keyFor = email => `otp:${sha256(`${secret()}:key:${email}`).slice(0, 32)}`;

export const normaliseEmail = value =>
  (typeof value === 'string' ? value : '').trim().toLowerCase();

export const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Uniform across all 10^6 values — randomInt rejects the biased tail rather
// than taking a modulus.
export const generateCode = () => String(randomInt(0, 1000000)).padStart(6, '0');

const constantTimeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// True while the address and IP are both under their hourly send limits.
export const canSend = async (email, ip) => {
  const perEmail = await store.incrWithTtl(`otp:sent:e:${sha256(email).slice(0, 32)}`, SEND_WINDOW_SECONDS);
  if (perEmail > MAX_SENDS_PER_EMAIL) return false;
  const perIp = await store.incrWithTtl(`otp:sent:i:${sha256(String(ip)).slice(0, 32)}`, SEND_WINDOW_SECONDS);
  return perIp <= MAX_SENDS_PER_IP;
};

// Issuing a new code replaces any outstanding one, and clears the attempt
// counter with it — asking for a fresh code is the way out of a lockout.
export const issueCode = async email => {
  const code = generateCode();
  const key = keyFor(email);
  await store.setEx(key, codeHash(email, code), CODE_TTL_SECONDS);
  await store.del(`${key}:n`);
  return code;
};

// Returns 'ok', 'bad' (wrong or unknown), or 'locked' (too many attempts).
//
// The attempt is counted before the comparison, so a wrong guess costs one
// whether or not the rest of the request succeeds, and five wrong guesses burn
// the code rather than merely refusing it.
export const checkCode = async (email, code) => {
  if (!/^\d{6}$/.test(String(code))) return 'bad';

  const key = keyFor(email);
  const stored = await store.get(key);
  if (!stored) return 'bad';

  const attempts = await store.incrWithTtl(`${key}:n`, CODE_TTL_SECONDS);
  if (attempts > MAX_ATTEMPTS) {
    await store.del(key);
    return 'locked';
  }

  if (!constantTimeEqual(stored, codeHash(email, code))) return 'bad';

  // Single use: a code that has worked once cannot work again, so a code read
  // over someone's shoulder or left in a mail client is spent.
  await store.del(key);
  await store.del(`${key}:n`);
  return 'ok';
};
