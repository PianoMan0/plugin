const PRODUCTS = {
  'usb-c-hub': 'USB-C Dock + Hub',
  'mechanical-keyboard': 'Mechanical Keyboard',
  'monitor-arm': 'Monitor Arm',
  'noise-canceling': 'Noise-Canceling Headphones',
  'developer-bundle': 'Developer Starter Bundle',
  'plugin-mentor': '1:1 Plugin Review Session'
};

const AIRTABLE_BASE_ID = 'appaHjrVmLG6dUvm2';
const AIRTABLE_TABLE_ID = 'tblALAPsKq9xOI6UX';
const MAX_ORDER_BYTES = 1024;

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) {
    return jsonResponse({ error: 'Order request origin was not accepted.' }, 403);
  }

  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: 'Order details must be sent as JSON.' }, 415);
  }

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_ORDER_BYTES) {
    return jsonResponse({ error: 'Order request is too large.' }, 413);
  }

  let order;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_ORDER_BYTES) {
      return jsonResponse({ error: 'Order request is too large.' }, 413);
    }
    order = JSON.parse(body);
  } catch {
    return jsonResponse({ error: 'Order details were not valid JSON.' }, 400);
  }

  if (!order || typeof order.productId !== 'string' || !Object.hasOwn(PRODUCTS, order.productId)) {
    return jsonResponse({ error: 'Choose a valid reward before placing your order.' }, 400);
  }

  if (!env.AIRTABLE_TOKEN) {
    console.error('AIRTABLE_TOKEN is not configured for the order function.');
    return jsonResponse({ error: 'Orders are temporarily unavailable. Please try again later.' }, 503);
  }

  let airtableResponse;
  try {
    airtableResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records: [{
            fields: {
              'Order Summary': PRODUCTS[order.productId],
              Status: 'New'
            }
          }]
        })
      }
    );
  } catch (error) {
    console.error('Could not reach Airtable:', error);
    return jsonResponse({ error: 'Could not reach Airtable. Please try again.' }, 502);
  }

  if (!airtableResponse.ok) {
    const errorDetails = await airtableResponse.text();
    console.error('Airtable rejected an order:', airtableResponse.status, errorDetails.slice(0, 500));
    return jsonResponse({
      error: 'Airtable could not save the order. Please try again or contact the PLUGIN team.'
    }, 502);
  }

  let airtableResult;
  try {
    airtableResult = await airtableResponse.json();
  } catch {
    console.error('Airtable returned an invalid success response.');
    return jsonResponse({ error: 'The order service returned an invalid response.' }, 502);
  }

  const orderId = airtableResult.records?.[0]?.id;
  if (typeof orderId !== 'string') {
    console.error('Airtable response did not include a created record ID.');
    return jsonResponse({ error: 'Airtable did not confirm that the order was saved.' }, 502);
  }

  return jsonResponse({ orderId }, 201);
}

export function onRequest({ request }) {
  return jsonResponse({ error: 'Method not allowed.' }, 405);
}
