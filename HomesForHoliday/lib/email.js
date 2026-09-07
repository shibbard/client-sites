// Sends the sign-in code and the purchase confirmation. Resend over plain
// fetch — no dependency, and the API is a single POST.
//
// Note what is deliberately absent: neither message contains a link that grants
// access. A code has to be typed into the browser that is signing in, so
// forwarding either email hands over nothing. If that changes, the paywall is
// only as strong as the buyer's willingness not to share their inbox.

const ENDPOINT = 'https://api.resend.com/emails';

const escapeHtml = s => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const formatDate = d => new Date(d).toLocaleDateString('en-GB',
  { day: 'numeric', month: 'long', year: 'numeric' });

const send = async ({ to, subject, text, html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || 'Home for Holiday <noreply@home-for-holiday.co.uk>';
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`resend ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
};

const shell = body => `<!doctype html>
<html lang="en"><body style="margin:0;background:#f4f4f1;font:16px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d2321">
  <div style="max-width:34rem;margin:0 auto;padding:32px 24px">
    <p style="margin:0 0 8px;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#8a8f8b">Home for Holiday</p>
    ${body}
  </div>
</body></html>`;

// The code itself. Sent whether or not the address has ever paid — what the
// code proves is the inbox, not the purchase; access is decided afterwards,
// from Stripe. That way this endpoint cannot be used to find out who is a
// customer.
export const sendSignInCode = async ({ to, code, siteUrl }) => {
  const text = [
    `Your Home for Holiday sign-in code is ${code}`,
    '',
    'Type it into the page you have open. It expires in 10 minutes and can only be used once.',
    '',
    'If you did not ask to sign in, you can ignore this — nobody can get in with this email alone.',
    '',
    siteUrl,
  ].join('\n');

  return send({
    to,
    subject: `${code} is your Home for Holiday sign-in code`,
    text,
    html: shell(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600">Your sign-in code</h1>
    <p style="margin:0 0 20px">Type this into the page you have open:</p>
    <p style="margin:0 0 20px;font:600 34px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.22em;color:#1d2321">${escapeHtml(code)}</p>
    <p style="margin:0 0 8px;color:#5c625e">It expires in 10 minutes and can only be used once.</p>
    <p style="margin:0;font-size:13px;color:#8a8f8b">If you did not ask to sign in, you can ignore this email &mdash; nobody can get in with it alone.</p>`),
  });
};

// Confirmation after payment. No link that unlocks anything: it tells them the
// window they have bought and how to get back in, which is the same way they
// got in the first time.
export const sendAccessNotice = async ({ to, expiresAt, siteUrl, renewed = false }) => {
  const until = formatDate(expiresAt);
  const opening = renewed ? 'Your access has been extended.' : 'Thank you — your access is live.';
  const signIn = `${siteUrl}/unlock.html`;

  const text = [
    opening,
    '',
    `The directory is open to you until ${until}.`,
    '',
    'You are already signed in on the device you paid on. On any other device,',
    `go to ${signIn}, enter this email address, and we will send you a six-digit`,
    'code to sign in with.',
    '',
    'Home for Holiday',
    siteUrl,
  ].join('\n');

  return send({
    to,
    subject: renewed ? 'Your Home for Holiday access has been extended' : 'Your Home for Holiday access is live',
    text,
    html: shell(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600">${escapeHtml(opening)}</h1>
    <p style="margin:0 0 20px">Every property in the directory links straight through to the owner&rsquo;s own website &mdash; no agency in the middle. Yours until <strong>${escapeHtml(until)}</strong>.</p>
    <p style="margin:0 0 20px">You are already signed in on the device you paid on. On your phone, or any other device:</p>
    <p style="margin:0 0 20px">
      <a href="${escapeHtml(signIn)}" style="display:inline-block;background:#c8792a;color:#fff;text-decoration:none;padding:13px 22px;border-radius:4px;font-weight:600">Sign in</a>
    </p>
    <p style="margin:0;font-size:13px;color:#8a8f8b">Enter this email address and we will send a six-digit code. There is no password to remember.</p>`),
  });
};
