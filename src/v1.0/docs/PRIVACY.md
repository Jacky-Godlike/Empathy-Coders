# Privacy and PDPA notes

OrderPilot is a synthetic-data hackathon prototype. This document explains the privacy posture of the demo and the principles a real deployment would apply under Malaysia's Personal Data Protection Act 2010 (PDPA).

---

## 1. Demo data

- Every customer, contact name, phone number, email, address, product, supplier, order and message is **fictional and team-created**.
- No real Orbyte platform, customer data, company records or personal data is used.
- The AI provider receives only the synthetic message text and the synthetic catalogue context required for extraction.
- The demo does not connect to WhatsApp, email, payment, banking or government systems.

---

## 2. Data flow

```text
Synthetic message (browser)
  → Express API
    → AI provider (classification/extraction) [optional]
    → Rules fallback [if AI unavailable]
  → Order + decision snapshot
  → JSON runtime files (server)
  → Browser UI / CSV / XLSX export
```

- The API key is read server-side from Replit Secrets or a gitignored `.env`.
- The key is never sent to the browser, embedded in HTML, written to logs or committed.
- The browser receives order data and source messages; the AI provider does not receive the customer master, stock, cost or supplier records. The prompt includes a compact catalogue (SKU, name, aliases, unit, catalogue price) because product matching benefits from it, but not unit cost, stock or margin.
- The AI model is used only for classification and extraction; it does not decide stock, margin, risk or approval.

---

## 3. PDPA principles in a real deployment

| Principle | How OrderPilot would implement it |
| --- | --- |
| **Purpose limitation** | Order data is used only for intake, verification, approval, procurement preparation and audit. No secondary marketing use without consent. |
| **Data minimisation** | Collect only the fields needed to fulfil the order: customer name, contact, address, items, delivery date and notes. Avoid identity documents, payment card data and unnecessary personal details. |
| **Retention** | Define a retention period (for example, 90 days for raw messages, 7 years for order/audit records if required by accounting rules). Delete or anonymise raw messages after extraction. |
| **Access control** | Role-based access: Owner/Manager can approve and edit; Staff can review and request info; auditors can read the log. Server-side enforcement, not just hidden UI. |
| **Security** | TLS in transit, secrets in a managed secret store, least-privilege API scopes, audit logging, input validation, rate limits, no credentials in source control. |
| **Data subject rights** | A process to access, correct and delete a customer's data, subject to legal retention obligations. The customer master supports correction; the audit log is append-only with a documented retention/legal-hold policy. |
| **Cross-border transfer** | If the AI provider processes data outside Malaysia, document the transfer basis, choose a provider/region with appropriate safeguards, and disclose it in the privacy notice. |
| **Accountability** | A data protection officer/owner, a processing register, vendor terms, incident response and periodic access reviews. |

---

## 4. What the demo does not do

- It does not collect real personal data.
- It does not process real payments.
- It does not submit statutory filings.
- It does not send real WhatsApp/email messages or real purchase orders.
- It does not provide legal or financial advice.
- It does not use customer data to train an AI model.

---

## 5. AI-specific safeguards

- **Strict output schema.** The model must return a known JSON shape; the server validates categories, operations, dates, quantities, prices and SKUs.
- **No invented data.** Missing fields stay null and become “Needs info”; the UI shows the raw source message next to the extracted fields.
- **Confidence threshold.** Low-confidence extraction is flagged for review.
- **Rules re-check.** Every business number is recalculated by the deterministic engine.
- **Human approval.** A person with the right role approves the consequential action; high risk requires a written note.
- **Fallback.** If the AI is unavailable or returns invalid output, the deterministic extractor runs. The UI labels the mode and the activity log records the fallback reason.
- **Provider terms.** The team should confirm that the chosen provider does not train on the submitted data (or use a provider/plan that offers that commitment). The demo data is synthetic, so the risk is low, but the production policy should be explicit.

---

## 6. Demo reset and retention

- The runtime JSON data persists on the Replit filesystem until the manager resets the demo or the deployment is replaced.
- The manager-only reset deletes `data/runtime`, restores the synthetic seed and logs the reset in the activity log.
- The audit log is append-only in the app; the only clear path is the explicit demo reset, which is itself recorded.

---

## 7. Production checklist

- [ ] Replace the simulated actor header with Orbyte SSO / signed sessions.
- [ ] Add a privacy notice and consent/notice flow for real customers.
- [ ] Define retention and deletion schedules.
- [ ] Use a managed database with encryption at rest and backups.
- [ ] Add tenant isolation and least-privilege API scopes.
- [ ] Review the AI provider's data processing terms and region.
- [ ] Add incident response and access review procedures.
- [ ] Keep secrets in Replit Secrets or a managed vault; rotate keys.
- [ ] Log access to personal data, not just business actions.
