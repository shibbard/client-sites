// Sends the sign-in code and the purchase confirmation. Resend over plain
// fetch — no dependency, and the API is a single POST.
//
// Note what is deliberately absent: neither message contains a link that grants
// access. A code has to be typed into the browser that is signing in, so
// forwarding either email hands over nothing. If that changes, the paywall is
// only as strong as the buyer's willingness not to share their inbox.

const ENDPOINT = 'https://api.resend.com/emails';

// Replies go to Gary, not into a noreply void. Someone who cannot get in will
// hit reply before they find a contact page.
const REPLY_TO = 'hfh.travel@outlook.com';

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
    body: JSON.stringify({ from, to: [to], reply_to: REPLY_TO, subject, text, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`resend ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
};

// Tables rather than flexbox: Outlook renders the desktop versions with Word's
// engine, which supports neither flex nor grid. Every colour is inline for the
// same reason — <style> blocks are stripped by several clients.
const shell = (body, siteUrl) => {
  const site = escapeHtml(siteUrl);
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#f4f4f1;font:16px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d2321">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f1">
    <tr><td align="center" style="padding:28px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:544px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e5e0">

        <tr><td align="center" style="padding:30px 32px 6px">
          <a href="${site}" style="text-decoration:none">
            <img src="${site}/images/logo-header-gold.png" width="168" alt="Home for Holiday"
                 style="display:block;width:168px;max-width:60%;height:auto;border:0">
          </a>
        </td></tr>

        <tr><td style="padding:14px 32px 30px">
          ${body}
        </td></tr>

        <tr><td style="padding:0 32px">
          <div style="border-top:1px solid #ecebe6;font-size:0;line-height:0">&nbsp;</div>
        </td></tr>

        <tr><td style="padding:20px 32px 28px;font-size:13px;line-height:1.6;color:#6f756f">
          <p style="margin:0 0 10px">
            <a href="${site}/destinations.html" style="color:#6f756f;text-decoration:underline">Destinations</a> &nbsp;&middot;&nbsp;
            <a href="${site}/faq.html" style="color:#6f756f;text-decoration:underline">FAQs</a> &nbsp;&middot;&nbsp;
            <a href="${site}/terms.html" style="color:#6f756f;text-decoration:underline">Terms</a> &nbsp;&middot;&nbsp;
            <a href="${site}/privacy-policy.html" style="color:#6f756f;text-decoration:underline">Privacy</a>
          </p>
          <p style="margin:0 0 10px">
            <a href="mailto:${REPLY_TO}" style="color:#6f756f;text-decoration:underline">${REPLY_TO}</a>
            &nbsp;&middot;&nbsp; <a href="tel:+447352816278" style="color:#6f756f;text-decoration:none">+44 7352 816278</a>
          </p>
          <p style="margin:0 0 10px">Home for Holiday is an independent directory of holiday homes. We are not a booking agent &mdash; every arrangement is made directly with the property owner.</p>
          <p style="margin:0;color:#9a9f9a">VLA Media Ltd &middot; South Town Lodge, South Town, Exeter, Devon EX6 8JE &middot; Company no. 17030518</p>
          <p style="margin:10px 0 0;color:#9a9f9a">You are receiving this because you asked to sign in or bought directory access. It is not a marketing email and there is nothing to unsubscribe from.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
};

const footerText = siteUrl => [
  '',
  '—',
  'Home for Holiday — an independent directory of holiday homes.',
  'We are not a booking agent; every arrangement is made directly with the owner.',
  '',
  `${siteUrl}  ·  ${REPLY_TO}  ·  +44 7352 816278`,
  'VLA Media Ltd · South Town Lodge, South Town, Exeter, Devon EX6 8JE · Company no. 17030518',
].join('\n');

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
    footerText(siteUrl),
  ].join('\n');

  return send({
    to,
    subject: `${code} is your Home for Holiday sign-in code`,
    text,
    html: shell(`
    <h1 style="margin:0 0 14px;font-size:21px;font-weight:600;color:#1d2321">Your sign-in code</h1>
    <p style="margin:0 0 18px">Type this into the page you have open:</p>
    <p style="margin:0 0 18px;padding:14px 0;background:#faf8f4;border:1px solid #efe7d8;border-radius:10px;text-align:center;font:700 32px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.22em;color:#1d2321">${escapeHtml(code)}</p>
    <p style="margin:0 0 8px;color:#5c625e">It expires in 10 minutes and can only be used once.</p>
    <p style="margin:0;font-size:13px;color:#8a8f8b">If you did not ask to sign in, you can ignore this email &mdash; nobody can get in with it alone.</p>`, siteUrl),
  });
};

// Confirmation after payment. No link that unlocks anything: it tells them the
// window they have bought and how to get back in, which is the same way they
// got in the first time.
export const sendAccessNotice = async ({ to, expiresAt, siteUrl, renewed = false }) => {
  const until = formatDate(expiresAt);
  const opening = renewed ? 'Your access has been extended.' : 'Thank you — your access is live.';
  // Straight to the sign-in form rather than the buy panel: this person has
  // already paid and must not be shown a payment button first.
  const signIn = `${siteUrl}/unlock.html?signin=1`;

  const text = [
    opening,
    '',
    `The directory is open to you until ${until}.`,
    '',
    'You are already signed in on the device you paid on. On any other device,',
    `go to ${signIn}, enter this email address, and we will send you a six-digit`,
    'code to sign in with.',
    footerText(siteUrl),
  ].join('\n');

  return send({
    to,
    subject: renewed ? 'Your Home for Holiday access has been extended' : 'Your Home for Holiday access is live',
    text,
    html: shell(`
    <h1 style="margin:0 0 14px;font-size:21px;font-weight:600;color:#1d2321">${escapeHtml(opening)}</h1>
    <p style="margin:0 0 18px">Every property in the directory links straight through to the owner&rsquo;s own website &mdash; no agency in the middle. Yours until <strong>${escapeHtml(until)}</strong>.</p>
    <p style="margin:0 0 18px">You are already signed in on the device you paid on. On your phone, or any other device:</p>
    <p style="margin:0 0 18px">
      <a href="${escapeHtml(signIn)}" style="display:inline-block;background:#c8792a;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:6px;font-weight:600">Sign in</a>
    </p>
    <p style="margin:0;font-size:13px;color:#8a8f8b">Enter this email address and we will send a six-digit code. There is no password to remember.</p>`, siteUrl),
  });
};
