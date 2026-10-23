# SDC2026 — Phase 1 Preliminary Project Proposal (draft)

> **How to use this file:** copy the relevant sections into the official
> `SDC Hackathon_ Submission Template` PDF, respect the stated word limits, add the
> team's details and signature, then export as
> `SDC2026_<TeamName>_Preliminary.pdf`.
>
> This is the working Markdown draft. The final PDF is
> `submission/SDC2026_EmpathyCoders_Preliminary.pdf`. The leader contact and
> Replit links are the only remaining placeholders.
> The official deadline is **25 October 2026, 7:59:59 AM MYT**.

---

## 1. Team and project overview

| Field | Response |
| --- | --- |
| Team name | `Empathy Coders` |
| Selected domain | Domain 2 — Orbyte Smart SME Challenge |
| Selected SDG track (1–17) | SDG 8 — Decent Work and Economic Growth (sub-targets 8.2 and 8.3) |
| Project / solution name | OrderPilot — Smart Order Consolidation and Approval for SMEs |
| Name (leader) | `Yang Jiahui` |
| Email & phone (leader) | `[TO BE COMPLETED]` / `[TO BE COMPLETED]` |
| University affiliation(s) | `Xiamen University Malaysia (XMUM)` |
| Number of team members | `5` |

---

## 2. Executive summary and problem statement

### 2.1 The problem context (maximum 250 words)

*Approximate draft length: 225 words.*

Malaysian micro and small businesses rarely receive orders through a tidy form. A café supplier gets a WhatsApp message for 20 boxes of coffee beans, an email for 40 sleeves of cups, a follow-up that adds 10 more boxes, and a correction that changes the quantity. Ads, price-list requests and supplier pitches arrive in the same inbox. The owner reads everything, copies it into Excel, checks stock, calculates cost and margin, and guesses whether a supplier can restock before the promised delivery date. This work happens after closing, on a phone, with no audit trail.

The burden is not only time. A missed message becomes a missed sale. A copied quantity becomes a wrong delivery. A quote below cost is discovered after the invoice. A stock shortage is discovered after the customer has been promised a date. Staff with different levels of digital confidence perform the same task differently, and there is no reliable record of who approved what.

The target users are owners and small teams of Malaysian micro and small businesses in food service, retail and distribution. They already use WhatsApp, email and spreadsheets; they cannot afford a custom ERP or weeks of training. They need one reliable, easy-to-learn workflow that connects the order to the business data, surfaces the risk, keeps a human in control and leaves a record. That is the gap OrderPilot addresses.

### 2.2 The proposed AI solution (maximum 300 words)

*Approximate draft length: 270 words.*

OrderPilot is a web application that turns WhatsApp, email and manual messages into one verified order desk. A message enters the inbox, and AI classifies it as an order, an order update, an inquiry, an advertisement, a supplier message, a payment reminder or spam. For orders, AI extracts the customer, contact, items, quantities, unit prices, delivery date, address and notes. Follow-up messages are consolidated into the same order: add, replace, remove or update the delivery date.

AI is used only where it adds value: reading unstructured language. Stock, cost, margin, delivery feasibility and risk are calculated by deterministic rules. The rules compare required quantity with available stock (on hand minus reserved), flag safety-stock warnings, check supplier lead time against the delivery date, calculate revenue, cost, gross profit and margin, detect a quote below cost or a price deviation, find possible duplicates, and list missing fields. The result is a transparent recommendation: Ready to accept, Procurement needed, Review recommended, Customer info needed, or High risk.

The owner or manager sees one table, not a message-by-message queue. Each row is an order with the customer, items, amount, delivery, stock, flags and recommendation. The approval is on the far right. The server enforces roles: staff can review and request information, but only the owner/manager can approve, reject or edit. High-risk approvals require a written justification. Approval reserves stock, creates internal purchase drafts for shortages, and writes an order record and an activity entry. Every import, analysis, approval, rejection and stock change is logged and can be exported to CSV or Excel.

The solution uses the skills from the SDC workshops: a GenAI API for extraction, a repository/data layer for business records, and Replit for cloud hosting and deployment. The AI provider is accessed through a server-side adapter; a deterministic fallback keeps the workflow running if the API is unavailable.

---

## 3. Technical architecture and implementation plan

### 3.1 Conceptual tech stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript (ES modules) | Order Desk, Inbox, Orders, Activity, Catalog, Settings |
| Backend | Node.js 20+, Express 4 | REST API, RBAC, triage orchestration, exports |
| Data | JSON files (seed committed; runtime gitignored) | Customers, products, stock, suppliers, messages, orders, drafts, activity |
| AI | DeepSeek `chat/completions` (OpenAI-compatible) through a provider-agnostic adapter; Gemini, OpenAI and Anthropic are also supported | Classification and field extraction only |
| Fallback | Deterministic rules extractor | Keeps the demo working without an API key |
| Exports | ExcelJS + CSV writer | Order and activity exports |
| Hosting | Replit (Core credit) | Required deployment platform |
| Repository | GitHub, Apache License 2.0 | Public source and commit history |
| GPU | None | No model training/fine-tuning; RunPod not used |

**System block diagram (text version):**

```text
WhatsApp / Email / Manual
          │
          ▼
   OrderPilot browser UI
          │  REST
          ▼
   Express API ──► Triage service ──► AI adapter (DeepSeek)
          │                │                    │
          │                └──► Rules fallback ◄─┘
          │
          ▼
   Order + approval service
     │        │         │
     ▼        ▼         ▼
 Decision   Inventory  Activity log
  engine    reserve /  (audit)
     │      purchase
     ▼      drafts
   JSON data store ◄── OrbyteAdapter (mock)
```

**Official SDC sponsor-provided resources:** We used the Replit Core credit for development and deployment. We did not use RunPod because the project has no GPU workload. We did not receive Orbyte production access; the Orbyte integration is a mock adapter over synthetic data, as required by the brief. The GenAI API is a team-selected external provider (DeepSeek `deepseek-flash` (V4.1 Flash)); the exact provider and model are declared in the Technical & Tools Declaration.

### 3.2 Design-thinking and deployment strategy (maximum 200 words)

*Approximate draft length: 185 words.*

We framed the problem around one recurring moment: the owner opening WhatsApp after closing and rebuilding the day’s orders in Excel. We mapped that journey — message, interpretation, data lookup, stock check, margin calculation, delivery promise, approval, record — and removed every step that did not need a human. The first prototype was a message list with extracted fields; testing it showed that the owner still had to compare messages one by one. We changed the primary object from “message” to “consolidated order” and made one table the default screen. We then tested the rules against a synthetic 29-message set covering clear orders, Malay/Manglish, add-ons, corrections, ads, inquiries, supplier pitches, payment reminders and spam.

The design is deliberately easy to learn: plain-language labels, visible reasons, no configuration before the first order, and a single approval action on the right. Deployment is Replit-first: the app has no build step, starts with `npm start`, seeds its own synthetic data, and provides a manager-only demo reset. A deterministic extraction fallback protects the live demo from API or network failure.

---

## 4. Preliminary environmental and SDG impact framework

| Field | Response |
| --- | --- |
| **Metric category** | Operational efficiency and order accuracy for micro/small businesses |
| **Target SDG sub-target(s)** | **SDG 8.2** — achieve higher levels of productivity through technological upgrading and innovation. **SDG 8.3** — promote development-oriented policies that support productive activities, decent job creation, entrepreneurship, creativity and innovation, and encourage the formalisation and growth of micro-, small- and medium-sized enterprises. |
| **Current problem baseline** | In our synthetic 12-message benchmark, manual reading, copying into a spreadsheet, stock checking and margin calculation took approximately **18 minutes per batch**. About **2 of 12** messages required a follow-up because a required field was missing, and **5 of 12** were non-orders that still consumed attention. This is an internal synthetic baseline, not a published statistic. |
| **Core measurable KPI** | (1) Minutes to process a 12-message batch. (2) Extraction/field error rate against a manually verified ground truth. (3) Number of missed orders in the test set. (4) Percentage of approvals with a complete actor + timestamp + reason audit entry. (5) Percentage of orders where stock and margin are checked before approval. |
| **Phase 2 impact target** | **60% reduction** in manual order-processing time per 12-message batch; **<2%** extraction error rate on the verified test set; **0 missed orders**; **100%** of approvals recorded with actor, timestamp and audit trail; **100%** of approved orders pre-checked for stock and margin. |
| **Measurement method** | Replay the same synthetic message set through the manual process and OrderPilot; compare elapsed time, field-level accuracy and missed orders. Record the rules and audit trail for every decision. Cite the synthetic dataset and the test script in the repository. |

**Why this matters for SDG 8:** A small business that spends less time copying orders can spend more time serving customers and growing. Fewer stockouts and wrong quotes protect the margin that keeps a micro-business viable. The workflow is designed for staff with different digital confidence, so adoption does not depend on formal training. The Orbyte adapter approach allows the same capability to reach many SMEs without a custom build.

**Environmental note (optional):** Better stock visibility can reduce over-ordering and waste, especially for perishable café supplies. We are not claiming a quantified environmental impact in Phase 1; it is a Phase 2 measurement opportunity (for example, reduced expired stock and fewer emergency deliveries).

---

## 5. Eligibility and readiness checklist

- [ ] All team members have completed the mandatory GenAI, Database and Cloud Deployment upskilling workshops.
- [ ] The project addresses a verified real-world problem mapped to SDG 8 (8.2 / 8.3).
- [ ] The solution is a functional, deployed application, not a theoretical business case.
- [ ] All fields in this template are completed within the stated word limits.
- [ ] The live prototype is deployed on Replit.
- [ ] The GitHub repository is public, includes Apache 2.0, and has a real commit history.
- [ ] No API keys or secrets are in the repository.

---

## 6. IP and originality declaration

### 6.1 Pre-existing / prior-owned work

**No.** The OrderPilot application, UI, rules engine, synthetic dataset and documentation were created by the team during the SDC Hackathon 2026 hacking period. The Apache License 2.0 `LICENSE` file is the standard license text; the official submission template and sample repository structure were provided by the organisers. Any small utility patterns are supporting code, not the core innovation.

### 6.2 Third-party code, datasets or models

| Name | Type | License | Use |
| --- | --- | --- | --- |
| Node.js | Code / runtime | MIT | Server runtime |
| Express | Code / framework | MIT | REST API |
| ExcelJS | Code / library | MIT | XLSX export |
| dotenv | Code / library | BSD-2-Clause | Local environment loading |
| DM Sans, Fraunces | Fonts | SIL Open Font License 1.1 | UI typography (Google Fonts) |
| DeepSeek `deepseek-flash` (V4.1 Flash) pre-trained model | Model / API | Provider terms | Message classification and field extraction only |
| Synthetic SME dataset | Dataset | Team-created; no third-party data | Demo customers, products, stock, suppliers, messages |

No public or private dataset was used for training or fine-tuning. No real personal or company data is included. The AI model is pre-trained and accessed through an API; it is not fine-tuned or self-trained by the team.

### 6.3 Employment-related IP conflicts

**No.** No team member is bound by an employment, internship or consulting agreement that would give an employer ownership of this hackathon work. *(The team must confirm this before submitting.)*

---

## 7. Declaration

By submitting this proposal, the team leader confirms that the information provided is accurate to the best of the team’s knowledge and that the project is original work created during the SDC Hackathon 2026 hacking period.

**Signature:** __________________________

**Name:** `Yang Jiahui`

**Date:** `21 October 2026`
