// Sends the access link. Resend over plain fetch — no dependency, and the API
// is a single POST.
//
// The email matters more than it looks: with no accounts, this link is how a
// buyer gets back in on another device, and how they recover access if they
// clear their cookies. If it lands in spam, someone who has just paid is stuck.

const ENDPOINT = 'https://api.resend.com/emails';

const escapeHtml = s => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const formatDate = d => new Date(d).toLocaleDateString('en-GB',
  { day: 'numeric', month: 'long', year: 'numeric' });

export const sendAccessLink = async ({ to, token, expiresAt, siteUrl, renewed = false }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || 'Home for Holiday <noreply@home-for-holiday.co.uk>';
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const link = `${siteUrl}/api/unlock?t=${encodeURIComponent(token)}`;
  const until = formatDate(expiresAt);
  const opening = renewed
    ? 'Your access has been extended.'
    : 'Thank you — your access is live.';

  const text = [
    opening,
    '',
    `Open the directory: ${link}`,
    '',
    `This link works until ${until}, on any device. Keep the email —`,
    'it is the quickest way back in if you change phone or clear your browser.',
    '',
    'Home for Holiday',
    siteUrl,
  ].join('\n');

  const html = `<!doctype html>
<html lang="en"><body style="margin:0;background:#f4f4f1;font:16px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d2321">
  <div style="max-width:34rem;margin:0 auto;padding:32px 24px">
    <p style="margin:0 0 8px;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#8a8f8b">Home for Holiday</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600">${escapeHtml(opening)}</h1>
    <p style="margin:0 0 24px">Every property in the directory links straight through to the owner&rsquo;s own website &mdash; no agency in the middle.</p>
    <p style="margin:0 0 24px">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#c8792a;color:#fff;text-decoration:none;padding:13px 22px;border-radius:4px;font-weight:600">Open the directory</a>
    </p>
    <p style="margin:0 0 8px">This link works until <strong>${escapeHtml(until)}</strong>, on any device.</p>
    <p style="margin:0 0 24px;color:#5c625e">Worth keeping this email &mdash; it is the quickest way back in if you change phone or clear your browser.</p>
    <p style="margin:0;font-size:13px;color:#8a8f8b;word-break:break-all">If the button does not work, paste this into your browser:<br>${escapeHtml(link)}</p>
  </div>
</body></html>`;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: renewed ? 'Your Home for Holiday access has been extended' : 'Your Home for Holiday access link',
      text,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`resend ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
};
