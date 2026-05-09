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

    if (path === '/api/terminals' && request.method === 'GET') {
      const mpResponse = await fetch('https://api.mercadopago.com/point/integration-api/devices', {
        headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` },
      });
      const data = await mpResponse.json();
      return Response.json({ status: mpResponse.status, data }, { headers: corsHeaders });
    }

    if (path === '/api/terminals-v1' && request.method === 'GET') {
      const mpResponse = await fetch('https://api.mercadopago.com/terminals/v1/list', {
        headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` },
      });
      const data = await mpResponse.json();
      return Response.json({ status: mpResponse.status, data }, { headers: corsHeaders });
    }

    if (path === '/api/test-payment' && request.method === 'GET') {
      const idempotencyKey = crypto.randomUUID();
      const externalRef = 'mago-test-' + Date.now();
      const body = {
        type: 'point',
        external_reference: externalRef,
        expiration_time: 'PT15M',
        transactions: { payments: [{ amount: '1.00' }] },
        config: {
          point: { terminal_id: env.MP_DEVICE_ID, print_on_terminal: 'seller_ticket' },
          payment_method: { default_type: 'debit_card' }
        }
      };
      const mpResponse = await fetch('https://api.mercadopago.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });
      const data = await mpResponse.json();
      return Response.json({ http_status: mpResponse.status, device_id_used: env.MP_DEVICE_ID, mp_response: data }, { headers: corsHeaders });
    }

    if (path === '/api/point/payment' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { amount, type } = body;
        const idempotencyKey = crypto.randomUUID();
        const externalRef = 'mago-' + Date.now();

        // Define forma de pagamento padrão na maquineta
        let defaultType = 'debit_card';
        if (type === 'credito') defaultType = 'credit_card';
        if (type === 'pix') defaultType = 'bank_transfer';

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
            transactions: { payments: [{ amount: parseFloat(amount).toFixed(2) }] },
            config: {
              point: { terminal_id: env.MP_DEVICE_ID, print_on_terminal: 'seller_ticket' },
              payment_method: { default_type: defaultType }
            }
          }),
        });
        const data = await mpResponse.json();
        if (!mpResponse.ok) {
          return Response.json({ error: true, mp_status: mpResponse.status, mp_response: data }, { status: 400, headers: corsHeaders });
        }
        return Response.json({ id: data.id, mp_status: mpResponse.status, mp_response: data }, { headers: corsHeaders });
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
