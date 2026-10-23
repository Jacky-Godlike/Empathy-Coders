# OrderPilot — API Reference

Base URL: `http://localhost:3000` locally, or your Replit deployment URL.

All endpoints return JSON unless they are file downloads.

---

## 1. Conventions

### Simulated actor

Send the demo actor in a header:

```http
X-OrderPilot-User: u-aina
```

| User | Role | Permissions |
| --- | --- | --- |
| `u-aina` | Owner / Manager | View, import, scan, approve, reject, edit, receive stock, reset |
| `u-daniel` | Staff / Reviewer | View, import, scan, request information |

If the header is absent, the server uses `u-aina`. An unknown id returns `401 UNKNOWN_ACTOR`.

For browser downloads (where a custom header is awkward), the same actor can be passed as a query parameter:

```text
/api/orders/export?format=csv&as=u-aina
```

This is a **demo RBAC simulation**, not real authentication. The server enforces the role on every consequential action.

### Error format

```json
{
  "error": {
    "code": "NEEDS_INFO",
    "message": "This order still has missing or unmatched information…",
    "details": { "missing": [{ "key": "address", "label": "Delivery address" }] }
  }
}
```

| Status | Meaning |
| --- | --- |
| 400 | Validation error or missing approval precondition |
| 401 | Unknown demo actor |
| 403 | Role does not have permission |
| 404 | Entity not found |
| 409 | State conflict (already approved, already received, already processed) |
| 429 | Rate limit on AI/intake endpoints |
| 500 | Unexpected server error |
| 502 | AI provider test failed |

### Rate limits

The AI/intake endpoints are limited in-memory per IP: triage 20/min, single-message scan 40/min, import 60/min, approve/reject/request-info 30/min, AI test 10/min, demo reset 5/min. Limits are generous for a live demo and protect against accidental loops.

---

## 2. Health and bootstrap

### `GET /api/health`

No actor required.

```json
{
  "ok": true,
  "version": "1.0.0",
  "time": "2026-10-21T13:00:00.000Z",
  "ai": { "configured": false, "mode": "rules", "provider": "rules", "model": null }
}
```

### `GET /api/bootstrap`

Returns everything the shell needs:

```json
{
  "business": { "name": "Kopi & Co. Supply", "timezone": "Asia/Kuala_Lumpur", "currency": "MYR" },
  "users": [],
  "actor": { "id": "u-aina", "name": "Aina Rahman", "role": "owner" },
  "ai": { "configured": false, "mode": "rules", "provider": "rules", "model": null, "detail": "…" },
  "rules": {
    "marginMinPct": 10,
    "marginRejectPct": 0,
    "priceDeviationPct": 15,
    "lowConfidence": 0.55,
    "duplicateWindowHours": 48,
    "consolidationWindowHours": 72,
    "handlingDays": 1
  },
  "stats": { "pendingOrders": 6, "pendingMessages": 12, "approved": 0, "…": "…" },
  "today": "2026-10-21",
  "orbyte": { "mode": "mock", "read": [], "write": [], "note": "…" },
  "channels": [],
  "demo": { "allowRoleSwitch": true }
}
```

### `GET /api/stats`

Returns the same statistics block without the rest of the bootstrap payload.

---

## 3. Messages and triage

### `GET /api/messages?status=all&limit=100`

`status` can be `all`, `new`, `processed`, `filtered` or `error`.

```json
{
  "messages": [
    {
      "id": "MSG-2001",
      "channel": "whatsapp",
      "from": "+60134017788",
      "fromName": "Kafe Hijau",
      "subject": null,
      "body": "Hi kak, nak order 15 packs teh tarik…",
      "receivedAt": "2026-10-21T…",
      "status": "new",
      "analysis": null,
      "orderId": null,
      "orderCode": null
    }
  ],
  "total": 12
}
```

### `POST /api/messages/import`

Adds a message to the inbox without processing it.

```json
{
  "channel": "whatsapp",
  "from": "+60123456789",
  "fromName": "Nurul Aisyah",
  "subject": null,
  "body": "Hi, I would like to order 8 boxes of Arabica coffee beans…"
}
```

Returns `201` with `{ "message": { … } }`.

### `POST /api/messages/import-and-analyze`

Imports one message and immediately processes it. Useful for the Inbox paste form.

```json
{
  "channel": "email",
  "from": "hello@example.com",
  "fromName": "Example Cafe",
  "subject": "Weekly order",
  "body": "Please supply 20 boxes of Arabica coffee beans…",
  "mode": "auto"
}
```

Returns:

```json
{
  "message": { "id": "MSG-3001", "status": "processed" },
  "triage": {
    "scanned": 1,
    "ordersCreated": 1,
    "ordersUpdated": 0,
    "filtered": 0,
    "errors": 0,
    "modeUsed": "ai",
    "provider": "deepseek",
    "model": "deepseek-flash",
    "latencyMs": 1840,
    "messageResults": [
      { "id": "MSG-3001", "status": "created", "orderId": "ord_op-1007", "orderCode": "OP-1007", "category": "order", "confidence": 0.93, "mode": "ai" }
    ]
  }
}
```

### `POST /api/triage/run`

Processes every message with `status: "new"`.

```json
{ "mode": "auto" }
```

`mode` can be:

- `auto` — use the configured AI if available, otherwise rules.
- `ai` — require AI; returns `400 AI_NOT_CONFIGURED` if no key.
- `rules` — force the deterministic fallback.

Response:

```json
{
  "scanned": 12,
  "ordersCreated": 5,
  "ordersUpdated": 2,
  "changeRequests": 0,
  "cancelled": 0,
  "filtered": 5,
  "errors": 0,
  "modeUsed": "rules",
  "provider": null,
  "model": null,
  "latencyMs": 78,
  "aiLatencyMs": 0,
  "fallbackReason": null,
  "orders": [],
  "messageResults": []
}
```

### `POST /api/triage/messages/:id`

Process one pending message. Same response shape.

---

## 4. Orders

### `GET /api/orders?status=pending`

| Status value | Meaning |
| --- | --- |
| `pending` (default) | `draft` + `needs_info`, with a fresh evaluation |
| `draft` | Awaiting approval |
| `needs_info` | Information requested |
| `approved` | Approved records |
| `rejected` | Rejected records |
| `superseded` | Replaced by a change request |
| `all` | Everything |

Each order includes `summary`, `recommendation`, `checks`, `totals`, `flags`, `canApprove`, `approvalRequiresNote` and `sourceMessageIds`.

```json
{
  "orders": [
    {
      "code": "OP-1001",
      "status": "draft",
      "customer": { "businessName": "Kedai Kopi Nurul", "name": "Nurul Aisyah", "phone": "+60 12-345 6789" },
      "items": [{ "sku": "BEAN-ARABICA-1KG", "quantity": 25, "productName": "Arabica Coffee Beans" }],
      "totals": { "revenue": 1512.5, "cost": 1095, "grossProfit": 417.5, "marginPct": 27.6 },
      "recommendation": {
        "code": "READY",
        "severity": "success",
        "shortLabel": "Ready",
        "reasons": []
      },
      "summary": {
        "items": "25 × Arabica Coffee Beans, 5 × Teh Tarik Powder",
        "stock": "All in stock",
        "flags": [],
        "delivery": "2026-10-23"
      },
      "canApprove": true,
      "approvalRequiresNote": false
    }
  ],
  "total": 6
}
```

### `GET /api/orders/:id`

`:id` accepts the internal id (`ord_op-1001`) or the display code (`OP-1001`).

Returns `{ order, messages, activities, purchaseDrafts, parent }`. Draft and needs-info orders are re-evaluated with current stock before returning.

### `PATCH /api/orders/:id`

Owner only. Correct extracted details. Checks recalculate immediately.

```json
{
  "customer": {
    "businessName": "Kafe Baru",
    "name": "Encik Faiz",
    "phone": "017-333 4455",
    "email": null,
    "address": "22, Jalan SS15/4, 47500 Subang Jaya"
  },
  "deliveryDate": "2026-10-30",
  "notes": "Call before delivery",
  "items": [
    { "sku": "BEAN-ARABICA-1KG", "quantity": 12, "unitPrice": 58 }
  ]
}
```

All fields are optional. `items`, if supplied, replaces the line list.

### `POST /api/orders/:id/approve`

Owner only.

```json
{ "note": "Customer is a long-term account; approved to backorder matcha." }
```

Approval:

1. Re-evaluates the order with current stock.
2. Blocks if `canApprove` is false.
3. Requires a note for `HIGH_RISK`.
4. Reserves available stock.
5. Creates purchase drafts for shortages.
6. Writes the activity log.

Response:

```json
{
  "order": { "code": "OP-1002", "status": "approved", "procurementPending": false },
  "purchaseDrafts": [],
  "recommendation": { "code": "READY" },
  "reservation": [{ "sku": "CUP-12OZ", "quantity": 40 }]
}
```

### `POST /api/orders/:id/reject`

Owner only. Reason required (minimum 3 characters).

```json
{ "reason": "Quoted price is below our unit cost." }
```

### `POST /api/orders/:id/request-info`

Owner or Staff. Generates a reply draft and sets `status: "needs_info"`.

```json
{ "note": "Ask for the café address and preferred delivery date." }
```

```json
{
  "order": { "code": "OP-1008", "status": "needs_info" },
  "replyDraft": {
    "channel": "whatsapp",
    "subject": null,
    "body": "Hi Kafe Faiz, thanks for your order. To confirm OP-1008, could you send us: delivery date, delivery address? …",
    "copyText": "Hi Kafe Faiz, …"
  }
}
```

The reply is not sent automatically. The UI presents a copy button.

---

## 5. Purchase drafts

### `GET /api/purchase-drafts`

```json
{
  "purchaseDrafts": [
    {
      "id": "PD-1001",
      "orderId": "ord_op-1003",
      "orderCode": "OP-1003",
      "supplierId": "SUP-DAIRY",
      "supplierName": "FarmFresh Distribution",
      "items": [{ "sku": "MILK-OAT-1L", "quantity": 10, "unitCost": 11, "lineCost": 110 }],
      "expectedDate": "2026-10-23",
      "status": "draft",
      "estimatedCost": 110,
      "note": "Internal draft only…"
    }
  ]
}
```

### `POST /api/purchase-drafts/:id/receive`

Owner only. Marks the draft received, increases `onHand` by the delivered quantity, reserves it for the order, and updates `procurementPending`.

```json
{
  "draft": { "id": "PD-1001", "status": "received" },
  "order": { "code": "OP-1003", "procurementPending": false }
}
```

No real purchase order is sent to the supplier at any point.

---

## 6. Activity log

### `GET /api/activity?limit=200&type=order&orderId=ord_op-1001`

| Query | Meaning |
| --- | --- |
| `limit` | 1–1000, default 200 |
| `type` | Action prefix, e.g. `order`, `stock`, `purchase_draft`, `triage`, `ai`, `message`, `export`, `demo` |
| `orderId` | Filter to one order |

```json
{
  "activities": [
    {
      "id": "ACT-1005",
      "at": "2026-10-21T…",
      "actor": { "id": "u-aina", "name": "Aina Rahman", "role": "owner" },
      "action": "order.approved",
      "entityType": "order",
      "entityId": "ord_op-1002",
      "orderId": "ord_op-1002",
      "summary": "OP-1002 approved by Aina Rahman…",
      "details": {}
    }
  ]
}
```

### `GET /api/activity/export?format=csv|xlsx&as=u-aina`

Downloads the audit trail.

---

## 7. Catalog

### `GET /api/catalog`

```json
{
  "stock": [
    {
      "sku": "BEAN-ARABICA-1KG",
      "productName": "Arabica Coffee Beans",
      "category": "Coffee",
      "unit": "1kg box",
      "onHand": 48,
      "reserved": 12,
      "available": 36,
      "safetyStock": 10,
      "status": "healthy",
      "sellingPrice": 58,
      "unitCost": 42,
      "supplierId": "SUP-BEAN",
      "supplierName": "Altitude Roasters",
      "leadTimeDays": 3,
      "lastCountedAt": "2026-10-18"
    }
  ],
  "products": [],
  "suppliers": [],
  "customers": []
}
```

---

## 8. AI

### `GET /api/ai/status`

```json
{
  "provider": "deepseek",
  "configured": true,
  "mode": "ai",
  "model": "deepseek-flash",
  "label": "AI · deepseek",
  "detail": "Messages are extracted with deepseek…"
}
```

### `POST /api/ai/test`

Owner only. Makes a minimal provider call.

```json
{ "ok": true, "configured": true, "provider": "deepseek", "model": "deepseek-flash", "latencyMs": 830 }
```

A provider failure returns `502` with the provider error message (the API key is redacted).

---

## 9. Exports

### `GET /api/orders/export?format=csv|xlsx&status=all&as=u-aina`

- `format=csv` — `text/csv`, UTF-8 BOM, formula-injection protection.
- `format=xlsx` — ExcelJS workbook, frozen header, auto-filter, formatted money columns.
- `status` — `all`, `pending`, `draft`, `needs_info`, `approved`, `rejected`, `superseded`.

### `GET /api/activity/export?format=csv|xlsx&as=u-aina`

Exports the audit trail with actor, action, entity, summary and JSON details.

---

## 10. Demo reset

### `POST /api/demo/reset`

Owner only.

```json
{ "confirm": "RESET" }
```

Deletes `data/runtime`, copies the seed, replays the 17 pre-analysed seed messages into 6 orders, and leaves 12 pending messages. It does not change the AI key. The reset is recorded in the activity log.

```json
{
  "ok": true,
  "result": { "seeded": true, "scanned": 17, "ordersCreated": 6, "ordersUpdated": 5, "filtered": 6, "pending": 12 },
  "stats": { "pendingOrders": 6, "pendingMessages": 12 }
}
```

---

## 11. Curl walkthrough

```bash
# 1. Health
curl -s http://localhost:3000/api/health

# 2. Bootstrap
curl -s http://localhost:3000/api/bootstrap

# 3. Scan the 12 pending messages (rules mode if no AI key)
curl -s -X POST http://localhost:3000/api/triage/run \
  -H 'Content-Type: application/json' \
  -H 'X-OrderPilot-User: u-aina' \
  -d '{"mode":"auto"}'

# 4. List the order desk
curl -s 'http://localhost:3000/api/orders?status=pending'

# 5. Open an order
curl -s http://localhost:3000/api/orders/OP-1002

# 6. Approve it
curl -s -X POST http://localhost:3000/api/orders/OP-1002/approve \
  -H 'Content-Type: application/json' \
  -H 'X-OrderPilot-User: u-aina' \
  -d '{}'

# 7. Staff cannot approve
curl -s -X POST http://localhost:3000/api/orders/OP-1001/approve \
  -H 'Content-Type: application/json' \
  -H 'X-OrderPilot-User: u-daniel' \
  -d '{}'

# 8. Export
curl -s -o orders.csv 'http://localhost:3000/api/orders/export?format=csv&status=all&as=u-aina'

# 9. Reset
curl -s -X POST http://localhost:3000/api/demo/reset \
  -H 'Content-Type: application/json' \
  -H 'X-OrderPilot-User: u-aina' \
  -d '{"confirm":"RESET"}'
```
