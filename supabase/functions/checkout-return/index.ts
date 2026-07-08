// Post-payment landing page for mobile Stripe hosted checkout. Android blocks
// automatic redirects to custom schemes, so the primary path is a tappable
// button (a user gesture is allowed to open the app). The app no longer
// depends on this deep link for data — it verifies the payment with the
// session id it already holds as soon as the browser closes.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const APP_SCHEME = 'd14';

serve((req: Request): Response => {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id') ?? 'cancelled';
  const cancelled = sessionId === 'cancelled';
  const target = `${APP_SCHEME}://checkout-complete?session_id=${encodeURIComponent(sessionId)}`;

  const heading = cancelled ? 'Checkout cancelled' : 'Payment complete!';
  const message = cancelled
    ? 'No payment was made. Close this window to return to the app.'
    : 'Close this window or tap the button below to return to the app and finish up.';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AMA District 14</title>
  <style>
    body { font-family: -apple-system, Roboto, sans-serif; background: #0A0A0A; color: #fff;
           display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .box { text-align: center; padding: 24px; max-width: 340px; }
    .check { font-size: 56px; margin-bottom: 8px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { color: #A5A9B0; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
    .btn { display: block; background: #E63946; color: #fff; text-decoration: none;
           font-weight: 700; font-size: 16px; padding: 16px 24px; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="check">${cancelled ? '&#10060;' : '&#9989;'}</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    <a class="btn" href="${target}">Return to the D14 App</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
