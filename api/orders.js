const PRODUCTS = Object.freeze({
  'usb-c-hub': 'USB-C Dock + Hub',
  'mechanical-keyboard': 'Mechanical Keyboard',
  'monitor-arm': 'Monitor Arm',
  'noise-canceling': 'Noise-Canceling Headphones',
  'developer-bundle': 'Developer Starter Bundle',
  'plugin-mentor': '1:1 Plugin Review Session'
});

const AIRTABLE_BASE_ID = 'appaHjrVmLG6dUvm2';
const AIRTABLE_TABLE_ID = 'tblALAPsKq9xOI6UX';
const MAX_ORDER_BYTES = 1024;

function sendJson(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const origin = req.headers.origin;
  const host = req.headers.host;
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = typeof forwardedProto === 'string'
    ? forwardedProto.split(',')[0].trim()
    : req.socket.encrypted ? 'https' : 'http';

  let expectedOrigin;
  try {
    if (typeof host !== 'string' || !['http', 'https'].includes(protocol)) {
      throw new Error('Invalid request host or protocol.');
    }
    expectedOrigin = new URL(`${protocol}://${host}`).origin;
  } catch {
    sendJson(res, 400, { error: 'Request host was invalid.' });
    return;
  }

  if (typeof origin !== 'string' || origin !== expectedOrigin) {
    sendJson(res, 403, { error: 'Order request origin was not accepted.' });
    return;
  }

  const contentType = req.headers['content-type'];
  if (typeof contentType !== 'string' || contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    sendJson(res, 415, { error: 'Order details must be sent as JSON.' });
    return;
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_ORDER_BYTES) {
    sendJson(res, 413, { error: 'Order request is too large.' });
    return;
  }

  let order = req.body;
  if (typeof order === 'string') {
    try {
      order = JSON.parse(order);
    } catch {
      sendJson(res, 400, { error: 'Order details were not valid JSON.' });
      return;
    }
  }

  let bodySize;
  try {
    bodySize = Buffer.byteLength(JSON.stringify(order));
  } catch {
    sendJson(res, 400, { error: 'Order details were not valid JSON.' });
    return;
  }
  if (bodySize > MAX_ORDER_BYTES) {
    sendJson(res, 413, { error: 'Order request is too large.' });
    return;
  }

  if (!order || typeof order !== 'object' || Array.isArray(order)
    || typeof order.productId !== 'string'
    || !Object.prototype.hasOwnProperty.call(PRODUCTS, order.productId)) {
    sendJson(res, 400, { error: 'Choose a valid reward before placing your order.' });
    return;
  }

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    console.error('AIRTABLE_TOKEN is not configured for the order function.');
    sendJson(res, 503, { error: 'Orders are temporarily unavailable. Please try again later.' });
    return;
  }

  let airtableResponse;
  try {
    airtableResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
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
    sendJson(res, 502, { error: 'Could not reach Airtable. Please try again.' });
    return;
  }

  if (!airtableResponse.ok) {
    const errorDetails = await airtableResponse.text();
    console.error('Airtable rejected an order:', airtableResponse.status, errorDetails.slice(0, 500));
    sendJson(res, 502, {
      error: 'Airtable could not save the order. Please try again or contact the PLUGIN team.'
    });
    return;
  }

  let airtableResult;
  try {
    airtableResult = await airtableResponse.json();
  } catch {
    console.error('Airtable returned an invalid success response.');
    sendJson(res, 502, { error: 'The order service returned an invalid response.' });
    return;
  }

  const orderId = airtableResult.records?.[0]?.id;
  if (typeof orderId !== 'string') {
    console.error('Airtable response did not include a created record ID.');
    sendJson(res, 502, { error: 'Airtable did not confirm that the order was saved.' });
    return;
  }

  sendJson(res, 201, { orderId });
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '1kb'
    }
  }
};
