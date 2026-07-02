import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!;


if (!SENDGRID_API_KEY) {
  console.error(
    'Missing SendGrid API key. Make sure to set the SENDGRID_API_KEY environment variable.'
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      console.log('Handling CORS preflight request');
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (req.method !== 'POST') {
      console.error('Invalid request method:', req.method);
      return new Response(
        JSON.stringify({ error: 'Only POST requests are allowed' }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const { to, subject, text, html } = await req.json();
    console.log('Received request with body:', { to, subject, text, html });

    // put all emails into a list of objects that are just to: [{email}]
    const personalizationMap = to.map((email: string) => ({ to: [{ email }] }));

    // for every email in the list, check if it has +child in the email. if it does, remove everything after the + and before the @
    personalizationMap.forEach(
      (personalization: { to: { email: string }[] }) => {
        const email = personalization.to[0].email;
        const plusIndex = email.indexOf('+');
        if (plusIndex !== -1) {
          const atIndex = email.indexOf('@');
          const newEmail =
            email.substring(0, plusIndex) + email.substring(atIndex);
          personalization.to[0].email = newEmail;
        }
      }
    );

    console.log('Sending emails to:', personalizationMap);

    // Override the 'to' field to always use the debug email
    const emailData = {
      personalizations: personalizationMap,
      from: { email: 'no-reply@em5910.ama-d14.org' },
      subject: subject,
      content: [{ type: 'text/html', value: html }],
    };

    console.log(
      'Constructed email payload for debug email:',
      JSON.stringify(emailData, null, 2)
    );

    // Validate batch size (SendGrid limit is 1000 personalizations per request)
    if (personalizationMap.length > 1000) {
      console.error('Batch too large:', personalizationMap.length);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Batch size exceeds 1000 recipients. Please send smaller batches.',
          sent: 0,
          failed: to
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    console.log('SendGrid API response status:', response.status);
    const responseText = await response.text();
    console.log('SendGrid API response text:', responseText);

    if (!response.ok) {
      console.error('Failed to send email with SendGrid:', responseText);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send email',
          sent: 0,
          failed: to
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        sent: to.length,
        failed: []
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
