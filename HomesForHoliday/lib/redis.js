// Upstash Redis over its REST API.
//
// Shared state for short-lived sign-in codes and rate limits, plus hashes of
// payment-alert references to suppress repeated notifications. No customer
// payment details are stored here.
//
// REST rather than a Redis client because it is a single POST — no connection
// pooling to get wrong in a serverless function, and no npm dependency.

const TIMEOUT_MS = 4000;

const endpoint = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set');
  return { url: url.replace(/\/+$/, ''), token };
};

// One Redis command. Arguments go as a JSON array, exactly as redis-cli would
// take them, so there is no string escaping to get wrong.
const command = async (...args) => {
  const { url, token } = endpoint();
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args.map(String)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`redis ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);

  const data = await res.json();
  if (data?.error) throw new Error(`redis: ${data.error}`);
  return data?.result ?? null;
};

export const get = key => command('GET', key);

export const setEx = (key, value, seconds) => command('SET', key, value, 'EX', seconds);

export const del = key => command('DEL', key);

// Atomic claim for operational alerts. Only hashes of references are stored.
export const setIfAbsent = (key, value, seconds) => command('SET', key, value, 'EX', seconds, 'NX');

// Counter that expires. The EXPIRE is only set on the first increment, so the
// window runs from the first attempt rather than sliding forward on every one —
// otherwise a fast enough attacker could hold a key alive indefinitely.
export const incrWithTtl = async (key, seconds) => {
  const n = Number(await command('INCR', key));
  if (n === 1) await command('EXPIRE', key, seconds);
  return n;
};
