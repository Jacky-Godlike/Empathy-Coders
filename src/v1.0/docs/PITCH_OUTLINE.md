# OrderPilot — pitch deck outline

Two formats:

- **Preliminary round:** a 5–7 minute recorded video with a prototype demo.
- **Final round:** a 10-minute live pitch + 5 minutes Q&A at XMUM.

The narrative is the same: **problem → approach → expected outcome**, with the live demo proving the automated journey.

---

## Slide 1 — Title

**On screen**

- OrderPilot
- Smart order consolidation and approval for SMEs
- Domain 2 · Orbyte Smart SME Challenge · SDG 8
- Team name, university, date

**Say**

> “Hi, we are `Empathy Coders`. We built OrderPilot: one order desk for small businesses that receive orders on WhatsApp and email.”

---

## Slide 2 — The problem

**On screen**

- One café supplier. 12 messages. One evening.
- WhatsApp orders, email orders, an add-on, a correction, an ad, a price-list request, a supplier pitch.
- The owner copies it all into Excel, checks stock, calculates margin, guesses the supplier lead time.
- A missed message = a missed sale. A wrong quantity = a wrong delivery. A below-cost quote = lost margin.
- No training budget, no custom ERP, no audit trail.

**Say**

> “This is not an efficiency slogan. It is a specific evening: reading 12 messages, rebuilding the day’s orders in Excel, and hoping nothing was missed.”

---

## Slide 3 — The insight

**On screen**

- The gap between the tools is filled by a person.
- The order is in WhatsApp. The stock is in a spreadsheet. The cost is in the owner’s head. The supplier lead time is in an old email.
- AI can read the message. But AI should not decide the business.
- The real product is **connected context + transparent rules + human control**.

**Say**

> “A general chatbot can read the message. It cannot tell you whether you have the stock, whether the margin is safe, or whether the supplier can deliver by Friday. That is the product.”

---

## Slide 4 — The product

**On screen**

- One Order Desk. Each row is an order, not a message.
- AI reads and extracts.
- Rules check stock, safety stock, supplier lead time, revenue, cost, margin, price deviation, duplicates and missing fields.
- The owner approves, rejects or requests information.
- Every action is logged.

**Visual:** a cropped screenshot of the Order Desk table with the recommendation badges.

**Say**

> “The owner never approves messages one by one. They approve orders. The table is the product.”

---

## Slide 5 — Live demo

**On screen**

- A short checklist of what the audience will see:
  1. 12 messages scanned
  2. 5 orders created + 2 updated + 5 filtered
  3. 3 messages consolidated into one order
  4. One-click approval → stock reserved
  5. Procurement → internal purchase draft
  6. High-risk gate → note required
  7. Request-info → reply draft
  8. Activity log + export

**Say**

> “Let me show you the whole chain live: trigger, connected data, decision, human approval, visible outcome and audit.”

**Demo:** use [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md). If the AI is unavailable, use the rules fallback and say so.

---

## Slide 6 — The rules are the trust layer

**On screen**

- Available = on hand − reserved
- Shortage = max(0, required − available)
- Lead time + handling vs delivery date
- Revenue / cost / gross profit / margin
- Price deviation vs catalogue
- Duplicate window
- Missing fields and extraction confidence
- Recommendation priority: Ready → Procurement → Review → Needs info → High risk

**Visual:** a simple flow or a cropped drawer screenshot showing the reasons.

**Say**

> “AI extracts. The rules decide. Every recommendation has a reason the owner can read, and the same inputs always produce the same output.”

---

## Slide 7 — People stay in control

**On screen**

- Owner/Manager: approve, reject, edit, reset
- Staff: view, import, scan, request info — no approval
- Server-enforced RBAC, not just a hidden button
- High-risk approval needs a written note
- Every import, analysis, approval, rejection and stock change is logged
- Export to CSV/XLSX

**Visual:** the staff drawer with locked Approve/Reject and the activity timeline.

**Say**

> “The system supports the decision; it does not replace the decision. The manager owns the consequence, and the audit trail shows who did what.”

---

## Slide 8 — Orbyte fit and reuse

**On screen**

- OrderPilot consumes Orbyte’s connected context: catalogue, inventory, suppliers, customers, roles, approvals, audit.
- A narrow `OrbyteAdapter` contract; the demo uses a mock adapter.
- A real Orbyte Connect adapter can replace it without touching the order desk.
- Reusable across many SMEs: per-tenant data, configurable rules, no custom build.
- Usage-based / per-order pricing fits Orbyte’s philosophy.

**Visual:** the adapter diagram from `ARCHITECTURE.md`.

**Say**

> “We are not building another all-in-one suite. We are building one reusable capability that plugs into the hub.”

---

## Slide 9 — Impact and SDG

**On screen**

- 12 messages → 11 verified orders in seconds, not an evening of copying.
- Stock, margin and delivery checked before the promise.
- Fewer missed orders, fewer wrong quotes, fewer stockouts.
- SDG 8.2: productivity through technological upgrading.
- SDG 8.3: support for micro/small enterprise growth.
- Synthetic benchmark: ~18 min manual per 12-message batch; target 60% reduction.
- KPI: time per batch, extraction error rate, missed orders, % approvals with a complete audit entry.

**Say**

> “The measurable benefit is time and accuracy. The business benefit is a promise the owner can keep.”

---

## Slide 10 — Business model and roadmap

**On screen**

- Model: freemium + usage-based (per order processed, per active SME) or partner/Orbyte revenue share.
- Phase 1: one order desk, synthetic data, mock adapter.
- Phase 2: real Orbyte Connect adapter, WhatsApp Business API/email intake, multi-tenant config, supplier confirmation.
- Phase 3: richer analytics, stockout avoidance, partner marketplace.

**Say**

> “Start with one painful workflow. Prove it. Then connect more of the business through Orbyte.”

---

## Slide 11 — Closing

**On screen**

- OrderPilot
- AI reads. Rules check. You approve.
- Live demo: `<LIVE_URL>`
- GitHub: `<GITHUB_URL>`
- Thank you.

**Say**

> “OrderPilot. One order desk. AI reads, rules check, you approve.”

---

## 5–7 minute video cut

| Time | Slides / demo |
| --- | --- |
| 0:00–0:35 | Slide 1 + 2 |
| 0:35–1:05 | Slide 4 |
| 1:05–2:05 | Demo: scan |
| 2:05–3:00 | Demo: consolidated order |
| 3:00–3:45 | Demo: approve |
| 3:45–4:35 | Demo: procurement + high-risk gate |
| 4:35–5:20 | Demo: request info + activity |
| 5:20–6:00 | Slide 7 + 8 |
| 6:00–6:30 | Slide 9 + 11 |

If the video runs long, cut the procurement detail and the staff role; keep the scan, consolidation, approval and activity log.

---

## 10-minute live pitch cut

| Time | Content |
| --- | --- |
| 0:00–1:00 | Slides 1–2: problem |
| 1:00–2:00 | Slides 3–4: insight + product |
| 2:00–5:30 | Live demo (scan → order → approve → risk → activity) |
| 5:30–7:00 | Slides 6–7: rules + human control |
| 7:00–8:15 | Slide 8: Orbyte fit |
| 8:15–9:15 | Slide 9: impact/SDG |
| 9:15–10:00 | Slides 10–11: model, roadmap, close |

Leave 5 minutes for Q&A. Have the rules fallback ready and a backup screen recording if the live deployment fails.

---

## Design notes

- One idea per slide. Large type. No paragraphs.
- Use screenshots of the actual product, not mockups.
- Put the recommendation badges and the activity log on screen early; they are the visual proof of the domain requirements.
- Keep the team introduction short; the product is the star.
- Put the live URL and GitHub URL on the closing slide.
- Rehearse the demo clicks until they are automatic. Use the demo script.
