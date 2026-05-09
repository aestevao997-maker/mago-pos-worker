export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/' || path === '') {
      return Response.json(
        { ok: true, service: 'mago-pos' },
        { headers: corsHeaders }
      );
    }

    if (path === '/api/point/payment' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { amount, description, payment_method } = body;
        const mpResponse = await fetch(
          `https://api.mercadopago.com/point/integration-api/devices/${env.MP_DEVICE_ID}/payment-intents`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: Math.round(amount * 100),
              description: description || 'Venda',
              payment_method: payment_method || 'credit_card',
            }),
          }
        );
        const data = await mpResponse.json();
        return Response.json(data, { headers: corsHeaders });
      } catch (err) {
        return Response.json(
          { error: err.message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    if (path.startsWith('/api/point/payment/') && request.method === 'GET') {
      try {
        const intentId = path.replace('/api/point/payment/', '');
        const mpResponse = await fetch(
          `https://api.mercadopago.com/point/integration-api/payment-intents/${intentId}`,
          {
            headers: {
              'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}`,
            },
          }
        );
        const data = await mpResponse.json();
        return Response.json(data, { headers: corsHeaders });
      } catch (err) {
        return Response.json(
          { error: err.message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    if (path === '/api/point/payment' && request.method === 'DELETE') {
      try {
        const mpResponse = await fetch(
          `https://api.mercadopago.com/point/integration-api/devices/${env.MP_DEVICE_ID}/payment-intents`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}`,
            },
          }
        );
        const data = await mpResponse.json();
        return Response.json(data, { headers: corsHeaders });
      } catch (err) {
        return Response.json(
          { error: err.message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: corsHeaders }
    );
  },
};
