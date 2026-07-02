// Bounce page for mobile Stripe hosted checkout. Stripe redirects the browser
// here after payment; we forward into the app via its deep link scheme so
// expo-web-browser's auth session can close and hand the session_id back.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const APP_SCHEME = 'd14';

serve((req: Request): Response => {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id') ?? 'cancelled';
  const target = `${APP_SCHEME}://checkout-complete?session_id=${encodeURIComponent(sessionId)}`;

  // Meta-refresh + JS + manual link: some Android browsers block 302s to
  // custom schemes, so belt and suspenders.
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Returning to AMA District 14…</title>
  <meta http-equiv="refresh" content="0;url=${target}">
  <style>
    body { font-family: -apple-system, Roboto, sans-serif; background: #0A0A0A; color: #fff;
           display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    a { color: #E63946; font-weight: 700; }
    .box { text-align: center; padding: 24px; }
  </style>
</head>
<body>
  <div class="box">
    <p>Returning to the AMA District 14 app…</p>
    <p><a href="${target}">Tap here if you are not redirected</a></p>
  </div>
  <script>window.location.href = ${JSON.stringify(target)};</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
