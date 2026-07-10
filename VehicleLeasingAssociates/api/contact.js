export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { vehicle, manufacturer, mileage, required_by, name, phone, whatsapp, info } = req.body || {};

  if (!vehicle || !manufacturer || !mileage || !required_by || !name || !phone || !whatsapp || !info) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const html = `
    <h2>New Quote Request — Vehicle Leasing Associates (UK)</h2>
    <p><b>Vehicle of Interest:</b> ${escapeHtml(vehicle)}</p>
    <p><b>Manufacturer / Type:</b> ${escapeHtml(manufacturer)}</p>
    <p><b>Mileage per Year:</b> ${escapeHtml(mileage)}</p>
    <p><b>Vehicle Required By:</b> ${escapeHtml(required_by)}</p>
    <p><b>Name:</b> ${escapeHtml(name)}</p>
    <p><b>Phone:</b> ${escapeHtml(phone)}</p>
    <p><b>Has WhatsApp:</b> ${escapeHtml(whatsapp)}</p>
    <p><b>Additional Information:</b><br>${escapeHtml(info).replace(/\n/g, '<br>')}</p>
  `;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vehicle Leasing Associates <forms@getdigitaldone.co.uk>',
        to: ['vla.uk@mail.com'],
        subject: `New Quote Request from ${name}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return res.status(502).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact form error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
