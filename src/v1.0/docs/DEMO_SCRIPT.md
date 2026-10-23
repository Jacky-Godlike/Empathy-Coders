# OrderPilot — 5–7 minute demo script

This is a recording and live-pitch script. It follows the domain journey exactly:

> **Trigger → connected data → decision logic → human approval → visible outcome + activity log**

The target length is **6:20**. Trim the optional sections if you need to stay under 7:00.

---

## Before recording

- [ ] `Settings → Reset demo data` (Owner). The desk should show **6 pending orders** and **12 pending messages**.
- [ ] Add the AI key in Replit Secrets and click `Settings → Test connection`. The sidebar should show **AI extraction on**.
- [ ] If you do not have an AI key, the demo still works. Say “rules fallback” out loud once; do not pretend it is AI.
- [ ] Browser zoom 100%. Close extra tabs and the bookmarks bar. Use a clean window at 1440×900 or larger.
- [ ] Start on the **Order Desk**, not the Inbox.
- [ ] Have the Orders page and Activity page already loaded in adjacent tabs? No — navigate live so the audience sees the flow.
- [ ] Do a rehearsal with a timer. The scan overlay takes ~2.2 seconds; do not talk over the entire animation.
- [ ] Record at 1080p if possible. The table text is small; 1440×900 at 100% is readable.

---

## The story in one sentence

> A café supplier’s WhatsApp and email orders arrive as 12 messy messages. OrderPilot turns them into 11 verified orders in one table, checks stock, margin and delivery against the business, and lets the owner approve with one click — with a full audit trail.

---

## Script

### 0:00–0:35 — The problem

**Show:** Order Desk, top of the page.

**Say:**

> “This is OrderPilot. It is built for a Malaysian café supplier — the kind of small business that receives orders on WhatsApp, email, and a paper notebook.
>
> This morning, 12 messages are waiting. Some are orders. Some are ads. One is a customer changing a quantity. One is a supplier pitch. The owner has to read all of them, copy the details into Excel, check stock, calculate margin, and work out whether a supplier can deliver in time.
>
> That is the recurring burden we remove.”

**Point at:** the pending count, the table headers, the “Synthetic data” pill.

---

### 0:35–1:05 — The product

**Show:** the Order Desk table.

**Say:**

> “OrderPilot gives the owner one clean order desk. Each row is an order, not a message. The columns show the customer, items, amount and margin, delivery, stock, the checks that failed, a transparent recommendation, and the approval action on the far right.
>
> The owner does not approve messages one by one. They approve orders.”

**Point at:** the five recommendation states — Ready, Procurement, Review, Needs info, High risk.

---

### 1:05–2:05 — Trigger and AI extraction

**Click:** `Scan inbox (12)`.

**Say while the overlay runs:**

> “The trigger is the inbox. OrderPilot reads every message, classifies it, and extracts the order fields. AI is used here because the input is unstructured language — WhatsApp, email, Malay, English, Manglish.
>
> Stock, cost, margin and risk are not AI decisions. Those are deterministic rules, because a business needs an answer it can explain and audit.”

**When the result appears:**

> “12 messages scanned. 5 new orders, 2 updates to existing orders, and 5 non-orders filtered. The ads, the price-list request and the supplier pitch never reach the order desk.”

**Point at:** the result metrics, then click **View order desk**.

---

### 2:05–3:00 — Connected data and consolidation

**Click:** the row `OP-1001 · Kedai Kopi Nurul`.

**Say:**

> “This customer sent three messages: the order, an add-on, and a correction. OrderPilot consolidated them into one order: 25 boxes of Arabica and 5 packs of Teh Tarik.
>
> On the right, the system has connected the customer master, the product catalogue, current stock, safety stock, supplier lead time, unit cost and the delivery date.”

**Point at:** the “3 source messages” subtitle, the items table, the financials, the stock check, the delivery feasibility, the source messages at the bottom.

> “Every number has a reason. The stock check shows required, available, supplier and lead time. The delivery check shows the days remaining and the handling buffer. The margin is calculated from the quoted price and our unit cost.”

**Optional:** scroll to the source messages to show the raw WhatsApp messages.

**Close:** the drawer.

---

### 3:00–3:45 — One-click human approval

**Click:** `Approve` on `OP-1002 · Brew & Bloom Café` (Ready).

**Say:**

> “This one is ready: all stock available, margin 31%, delivery feasible. The owner approves with one click.
>
> That single click is the human approval the domain requires. The system then reserves the stock, writes the order record, and records who approved it and when.”

**Show:** the toast “Order approved · OP-1002 is approved. Stock reserved.” The row disappears; the nav count changes.

**Point at:** the sidebar — Order Desk 5, Orders 1.

---

### 3:45–4:35 — Procurement, not a guess

**Click:** `Approve` on `OP-1004 · The Daily Grind` (Procurement).

**Say:**

> “This order is short seven bottles of caramel syrup. The supplier lead time is four days plus one handling day. The delivery is next Monday, so the shortage can be restocked in time. The recommendation is procurement, not rejection.
>
> Approving it does not send a real purchase order. It creates an internal purchase draft — a visible, auditable reminder. Nothing leaves the building automatically.”

**Confirm** the purchase draft dialog.

**Show:** the toast and the approved order.

**Optional:** go to **Orders** and point at the purchase draft card, with supplier, quantity, cost and expected date.

---

### 4:35–5:20 — Exceptions stay human

**Click:** the row `OP-1005 · Aroma Corner` (High risk).

**Say:**

> “This one is high risk. Matcha is short, the supplier lead time is three days, and the customer wants it tomorrow. The system will not let the owner approve it silently.
>
> The recommendation explains why. The approval button becomes an override, and it requires a written justification. That note goes into the audit log.”

**Point at:** the reason list, the required note label, the “High-risk” banner.

**Do not approve it** in the short video; close the drawer. The point is that the gate exists.

**Then open** `OP-1008 · Kafe Faiz` (Needs info).

> “This customer forgot the address and the delivery date. OrderPilot does not guess. It flags the missing fields and generates a reply draft the owner can copy into WhatsApp or email.”

**Click:** `Request info`. Show the modal with the draft.

**Say:**

> “The order stays in the desk as ‘Info requested’ until the customer replies. No stock is reserved and no order is confirmed.”

**Close** the modal and drawer.

---

### 5:20–6:00 — Visible outcome and audit

**Navigate:** **Orders & purchases**.

**Say:**

> “The Orders page is the record. Approved orders, rejected orders, and the internal purchase drafts. The owner can export the current view as CSV or Excel for the accountant or the weekly review.”

**Click:** `Excel` (download). Then **Activity log**.

> “Every import, every scan, every approval, every stock reservation and every purchase draft is in the activity log. This is the audit trail the domain asks for.”

**Point at:** the `order.approved`, `stock.reserved`, `purchase_draft.created` entries and the actor.

---

### 6:00–6:30 — Orbyte fit, impact and close

**Navigate:** **Settings**.

**Say:**

> “OrderPilot is designed as a capability that can live inside Orbyte. The app talks to one small adapter contract for catalogue, inventory, suppliers, customers, purchase drafts and audit events. Today it is a mock adapter over synthetic data. A real Orbyte Connect adapter can replace it without touching the order desk.
>
> The rules are visible and configurable. Roles are enforced on the server: staff can review and request information, but only the owner can approve. High-risk orders need a note.
>
> The measurable benefit: 12 messages processed in seconds instead of an evening of copying; fewer missed orders; fewer wrong quotes; stock and margin checked before the promise is made. That supports SDG 8.3 — better productivity and growth for small businesses.”

**Close:**

> “OrderPilot. One order desk. AI reads, rules check, you approve.”

---

## Fallback line if the AI is unavailable

If the scan overlay shows an error or you are running without a key:

> “OrderPilot has a deterministic rules fallback for exactly this situation. The AI adds value on unstructured language, but the demo and the business must not depend on a live model. Watch.”

Click **Run rules fallback** in the overlay. The same journey continues. The result shows **Rules fallback**; say so plainly. This honesty is a strength, not a weakness.

If the AI key is configured but the network is unreliable, the triage service also falls back automatically per failed chunk; the scan result shows “Mixed” or a fallback note.

---

## Optional 30-second additions

Use these only if you have time:

- **Staff role:** switch the role to Daniel in the sidebar, open an order, point at the locked Approve/Reject buttons and the “Staff access” banner, then switch back to Aina. This demonstrates server-enforced RBAC.
- **Mark purchase draft received:** Orders → purchase draft → `Mark received` → stock is received and reserved to the order. This closes the procurement loop.
- **Catalog:** show available stock, safety stock and supplier lead times; the red margins and low-stock bars explain the recommendations.
- **Reset:** Settings → Reset demo data → type RESET. This is the demo safety net and is recorded in the activity log.

---

## Judge Q&A preparation

### “Why not just use ChatGPT?”

> “The value is not the chat. It is the connected business context and the control layer: the customer master, catalogue, stock, cost, supplier lead time, the deterministic rules, the approval gate and the audit log. A general chatbot cannot reserve stock or tell you whether the supplier can deliver before Friday.”

### “How do you handle AI hallucinations?”

> “The AI output is constrained to a strict JSON schema, validated against the catalogue, and every number is re-checked by the rules engine. A low-confidence extraction is flagged. Missing or unknown data becomes ‘Needs info’, not a guess. The human approves the final order, and the raw source messages are shown next to the extracted fields.”

### “What happens if the API is down?”

> “The deterministic extractor runs the same journey. It is slower to adapt to unusual wording, but it is reliable. The UI labels the mode, and the activity log records the fallback reason. The demo never depends on a live network call.”

### “Is this just an ERP?”

> “No. It is one focused capability: order intake and approval. We deliberately do not do accounting, payroll or fulfilment. The adapter is designed so Orbyte or a partner can supply the surrounding systems.”

### “How does it fit Orbyte?”

> “OrderPilot consumes Orbyte’s connected business context — catalogue, inventory, suppliers, customers, roles, approvals and audit — through a narrow adapter. It can be a module in the Orbyte hub, priced per order or per active SME, and reused across many small businesses without a custom build.”

### “What is the measurable benefit?”

> “In the synthetic test set, 12 messages become 11 verified orders in a few seconds, instead of roughly 18 minutes of manual reading and copying. More importantly, the system checks stock, margin and delivery before the owner promises anything, and every decision is auditable. The estimate in the app is 1.5 minutes per message plus 3 minutes per approved order; the real value is the errors and missed orders avoided.”

### “What are the limitations?”

> “The data is synthetic, authentication is simulated, the JSON store is single-process, and the WhatsApp/email intake is a paste/upload demo rather than a live connector. Those are deliberate MVP boundaries. The adapter interfaces are the path to production.”

### “What would you build next?”

> “A real Orbyte Connect adapter, WhatsApp Business API and email intake, multi-tenant configuration, split/merge for consolidated orders, supplier confirmation, and richer impact analytics.”

---

## One-page cheat sheet

| Time | Action | Message |
| --- | --- | --- |
| 0:00 | Order Desk | 12 messy messages, one owner, evening admin |
| 0:35 | Point at table | One row = one order; approve on the right |
| 1:05 | Scan inbox | AI classifies/extracts; rules decide |
| 2:05 | Open OP-1001 | 3 messages → 1 order; stock/margin/delivery |
| 3:00 | Approve OP-1002 | Human approval → reservation → audit |
| 3:45 | Approve OP-1004 | Procurement draft, no real PO |
| 4:35 | Open OP-1005, OP-1008 | High-risk gate; request info draft |
| 5:20 | Orders + Activity | Records, exports, audit trail |
| 6:00 | Settings | Orbyte adapter, rules, impact, close |

**Do not forget:**

- Say “synthetic data” once.
- Say “AI extracts, rules decide” once.
- Say “human approves” once.
- Say “activity log” once.
- If using rules fallback, say it plainly.
