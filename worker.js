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
      return Response.json({ ok: true, service: 'mago-pos' }, { headers: corsHeaders });
    }

    if (path === '/api/point/payment' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { amount, description } = body;

        const idempotencyKey = crypto.randomUUID();
        const externalRef = 'mago-' + Date.now();

        const mpResponse = await fetch('https://api.mercadopago.com/v1/orders', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            type: 'point',
            external_reference: externalRef,
            expiration_time: 'PT15M',
            transactions: {
              payments: [{ amount: amount }]
            },
            config: {
              point: {
                terminal_id: env.MP_DEVICE_ID,
                print_on_terminal: true,
              }
            }
          }),
        });

        const data = await mpResponse.json();
        // Retorna o erro completo do MP para debug
        return Response.json({ mp_status: mpResponse.status, mp_response: data }, { headers: corsHeaders });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    if (path.startsWith('/api/point/payment/') && request.method === 'GET') {
      try {
        const orderId = path.replace('/api/point/payment/', '');
        const mpResponse = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
          headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` },
        });
        const data = await mpResponse.json();
        const status = data.status;
        let state = 'OPEN';
        if (status === 'processed') state = 'FINISHED';
        if (status === 'canceled' || status === 'cancelled') state = 'CANCELED';
        if (status === 'error') state = 'ERROR';
        const payment = data.transactions?.payments?.[0];
        const paymentState = payment?.status === 'processed' ? 'APPROVED' : payment?.status;
        return Response.json({ ...data, state, payment: { state: paymentState } }, { headers: corsHeaders });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    if (path === '/api/point/payment' && request.method === 'DELETE') {
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
  },
};
