// Stripe is the customer record.
//
// There is no members table, so "how long does this person have left?" is
// answered by replaying their payments. Every paid checkout adds 30 days,
// stacking on whatever was still unused at the time it was made — so buying
// twice in one week gives 60 days from the first purchase, not 30 from the
// second.
//
// Because it is a pure fold over Stripe's own history, signing in on a new
// device recomputes exactly the same expiry as the original purchase did. No
// state of ours has to agree with anything.
import { ACCESS_DAYS } from './token.js';

const DAY_MS = 864e5;

export const foldAccessEnd = sessions => {
  let end = 0;
  for (const cs of [...sessions].sort((a, b) => a.created - b.created)) {
    const paidAt = cs.created * 1000;
    end = Math.max(end, paidAt) + ACCESS_DAYS * DAY_MS;
  }
  return end ? new Date(end) : null;
};

// Every paid checkout session belonging to this address. Stripe is asked by
// customer because `customer_creation: 'always'` on the checkout means each
// purchase leaves a Customer behind, even though these are one-off payments.
export const paidSessionsFor = async (stripe, email) => {
  const { data: customers } = await stripe.customers.list({ email, limit: 10 });
  const paid = [];
  for (const customer of customers) {
    const { data: sessions } = await stripe.checkout.sessions.list({ customer: customer.id, limit: 100 });
    for (const cs of sessions) if (cs.payment_status === 'paid') paid.push(cs);
  }
  return paid;
};

// The end of this address's access, or null if they have never paid. May be in
// the past — the caller decides what an expired window means.
export const accessEndFor = async (stripe, email) =>
  foldAccessEnd(await paidSessionsFor(stripe, email));
