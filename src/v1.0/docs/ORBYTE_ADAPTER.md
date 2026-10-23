# Orbyte adapter

OrderPilot is designed as a capability that can sit inside the Orbyte hub. The rest of the application depends on a small adapter contract, not on a particular Orbyte endpoint. The demo uses a mock implementation over synthetic data. This document explains the contract and how a real Orbyte Connect adapter would replace it.

---

## 1. The contract

`server/adapters/orbyte/orbyteAdapter.js`

```js
class OrbyteAdapter {
  async getCatalog() { }                  // Product[]
  async getInventory() { }                // StockRow[]
  async getSuppliers() { }                // Supplier[]
  async getCustomers() { }                // Customer[]
  async createPurchaseDraft(draft) { }    // PurchaseDraft
  async emitAuditEvent(event) { }         // Activity
}
```

| Method | Direction | Used by | Purpose |
| --- | --- | --- | --- |
| `getCatalog` | read | decision engine, AI prompt | SKU, name, aliases, unit, price, cost, safety stock |
| `getInventory` | read | decision engine | on-hand, reserved, last counted |
| `getSuppliers` | read | decision engine, purchase drafts | lead time, MOQ, payment terms |
| `getCustomers` | read | order service | customer master, address, contact |
| `createPurchaseDraft` | write | inventory service | internal purchase reminder |
| `emitAuditEvent` | write | (future) audit bridge | forward an activity entry to Orbyte |

The mock (`mockOrbyteAdapter.js`) delegates to the JSON repositories:

```js
getCatalog()              -> catalog.getProducts()
getInventory()            -> catalog.getStock()
getSuppliers()            -> catalog.getSuppliers()
getCustomers()            -> catalog.getCustomers()
createPurchaseDraft(d)    -> purchaseDrafts.add(d)
emitAuditEvent(e)         -> activities.append(e)
```

The `capabilities()` method exposes the read/write surface to the Settings page so judges can see the integration seam.

---

## 2. Why this is a reusable building block

- **Services do not know Orbyte.** The order service, inventory service and decision engine depend on the interface, not the HTTP shape.
- **Data is synthetic and local.** The demo can run without Orbyte credentials.
- **The write path is visible.** Purchase drafts and audit events go through the adapter, which is exactly where a real integration would enforce authentication, idempotency and retries.
- **The contract maps to Orbyte's shared capabilities.** Catalogue, inventory, suppliers and customers are the “connected business context”; purchase drafts and audit events are the workflow/governance side.

---

## 3. A real Orbyte Connect adapter

A production adapter would implement the same six methods against Orbyte Connect / Open APIs.

### Authentication

- OAuth 2.0 client credentials or Orbyte SSO delegated tokens.
- Store client id/secret in Replit Secrets.
- Never expose tokens to the browser.
- Use the Orbyte tenant/org id in every request.

### Data mapping

| OrderPilot | Orbyte |
| --- | --- |
| Product `sku` | Catalogue item id / SKU |
| Product `sellingPrice` | Selling price / price list |
| Product `unitCost` | Cost price (permissioned) |
| Stock `onHand` / `reserved` | Inventory location balance |
| Supplier `leadTimeDays` | Supplier/lead time record |
| Customer `phone` / `email` | Party/contact record |
| Purchase draft | Procurement draft/requisition |
| Activity | Audit trail event |

### Write safety

- **Idempotency key** on `createPurchaseDraft`: `order.id + supplierId + draft version`. A retry must not create two drafts.
- **Retries** with exponential backoff on 429/5xx; do not retry 4xx validation errors.
- **Circuit breaker** and a queue for transient failures.
- **Compensation**: if the draft is created but the order approval write fails, mark the draft `orphaned` for a human to review; never silently duplicate.
- **No real purchase order** is sent automatically. The draft requires a human procurement action, matching the demo boundary.

### Permissions

- Read catalogue/inventory only with the scopes granted to the OrderPilot integration.
- Create purchase drafts only for the authenticated SME tenant.
- `emitAuditEvent` should use a service identity and include the human actor who approved.
- Respect Orbyte roles: the demo’s `u-aina`/`u-daniel` would map to Orbyte roles/permissions.

### Webhooks / events

A production integration would subscribe to:

- Catalogue/price changes → refresh the extraction catalogue.
- Stock adjustments → recalculate draft recommendations.
- Order/purchase-draft status changes → update the order desk.
- User/role changes → refresh permissions.

In the demo these are polled on each page load (the data is small).

### Observability

- Log provider request id, tenant id, latency and outcome (not the API key or full customer data).
- Emit an `integration.error` activity for the manager.
- Surface a “last synced” timestamp in Settings.

---

## 4. Reuse across many SMEs

- The catalogue, suppliers, customers and rules are per-tenant configuration, not code.
- The adapter can be instantiated per Orbyte tenant with different credentials and scopes.
- The decision rules are environment/config driven (margin threshold, lead-time handling, consolidation window).
- The UI is a single, learnable pattern; a new SME sees the same order desk with its own data.
- The purchase draft and audit entries are the natural points for an Orbyte marketplace/partner integration.

---

## 5. What the demo deliberately does not do

- Connect to a live Orbyte tenant.
- Send a real purchase order to a supplier.
- Process payments or statutory filings.
- Use real customer or company data.
- Replace Orbyte identity, payroll or accounting.

The mock adapter is a proof of the integration shape, not a claim of a live Orbyte connection.
