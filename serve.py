import json
import logging
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
PRODUCTS = {
    "usb-c-hub": "USB-C Dock + Hub",
    "mechanical-keyboard": "Mechanical Keyboard",
    "monitor-arm": "Monitor Arm",
    "noise-canceling": "Noise-Canceling Headphones",
    "developer-bundle": "Developer Starter Bundle",
    "plugin-mentor": "1:1 Plugin Review Session",
}
AIRTABLE_BASE_ID = "appaHjrVmLG6dUvm2"
AIRTABLE_TABLE_ID = "tblALAPsKq9xOI6UX"
MAX_ORDER_BYTES = 1024


class ShopHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlsplit(self.path).path == "/api/orders":
            self.send_json(405, {"error": "Method not allowed."})
            return
        super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path != "/api/orders":
            self.send_json(404, {"error": "Not found."})
            return

        origin = self.headers.get("Origin")
        try:
            origin_url = urlsplit(origin or "")
            accepted_origin = (
                origin_url.scheme == "http"
                and origin_url.hostname in {"127.0.0.1", "localhost"}
                and origin_url.port == self.server.server_port
                and origin_url.path in {"", "/"}
                and not origin_url.query
                and not origin_url.fragment
            )
        except ValueError:
            accepted_origin = False
        if not accepted_origin:
            self.send_json(403, {"error": "Order request origin was not accepted."})
            return

        content_type = self.headers.get("Content-Type", "").lower()
        if not content_type.startswith("application/json"):
            self.send_json(415, {"error": "Order details must be sent as JSON."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self.send_json(400, {"error": "Order request length is invalid."})
            return
        if content_length < 1:
            self.send_json(400, {"error": "Order details are required."})
            return
        if content_length > MAX_ORDER_BYTES:
            self.send_json(413, {"error": "Order request is too large."})
            return

        try:
            order = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "Order details were not valid JSON."})
            return

        product_id = order.get("productId") if isinstance(order, dict) else None
        if not isinstance(product_id, str) or product_id not in PRODUCTS:
            self.send_json(400, {"error": "Choose a valid reward before placing your order."})
            return

        token = os.environ.get("AIRTABLE_TOKEN")
        if not token:
            logging.error("AIRTABLE_TOKEN is not configured.")
            self.send_json(503, {"error": "Orders are unavailable. Configure AIRTABLE_TOKEN and restart the local server."})
            return

        self.create_order(product_id, token)

    def create_order(self, product_id, token):
        url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE_ID}"
        body = json.dumps({
            "records": [{
                "fields": {
                    "Order Summary": PRODUCTS[product_id],
                    "Status": "New",
                }
            }]
        }).encode("utf-8")
        request = Request(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=15) as response:
                result = json.loads(response.read())
        except HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            logging.error("Airtable rejected an order (%s): %s", error.code, details[:500])
            self.send_json(502, {"error": "Airtable could not save the order. Check the Airtable fields and token, then try again."})
            return
        except (URLError, TimeoutError) as error:
            logging.error("Could not reach Airtable: %s", error)
            self.send_json(502, {"error": "Could not reach Airtable. Check your connection and try again."})
            return
        except (json.JSONDecodeError, UnicodeDecodeError):
            logging.error("Airtable returned an invalid response.")
            self.send_json(502, {"error": "Airtable returned an invalid response."})
            return

        records = result.get("records") if isinstance(result, dict) else None
        order_id = records[0].get("id") if records and isinstance(records[0], dict) else None
        if not isinstance(order_id, str):
            logging.error("Airtable did not confirm a created record ID.")
            self.send_json(502, {"error": "Airtable did not confirm that the order was saved."})
            return

        self.send_json(201, {"orderId": order_id})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), ShopHandler)
    print(f"PLUGIN shop available at http://127.0.0.1:{port}/shop.html")
    server.serve_forever()
