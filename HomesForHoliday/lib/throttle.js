// Best-effort burst limit on the gate.
//
// Honest about what this is: it lives in the memory of one warm function
// instance, so it resets on a cold start and does not see requests handled
// elsewhere. Without a database that is the ceiling. It still costs a scraper
// something, and it costs a real person nothing — nobody opens 25 properties in
// ten minutes by clicking.
//
// If sharing ever becomes a real problem, that is the signal to put a small
// store behind this, not to tighten the numbers.

const WINDOW_MS = 10 * 60 * 1000;
const MAX_EVENTS = 25;
const MAX_KEYS = 5000;          // bounded so a burst of distinct tokens cannot grow this without limit

const hits = new Map();

export const isThrottled = key => {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => now - t < WINDOW_MS);

  if (recent.length >= MAX_EVENTS) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_KEYS) {
    for (const [k, times] of hits) {
      if (!times.length || now - times[times.length - 1] > WINDOW_MS) hits.delete(k);
      if (hits.size <= MAX_KEYS) break;
    }
  }
  return false;
};

export { WINDOW_MS, MAX_EVENTS };
