# Empathy-Coders — SmartOrder Hub V3.0

**SDC Hackathon 2026 · Domain 2: Orbyte Smart SME Challenge**  
**Team:** Empathy-Coders · Xiamen University Malaysia

> **Live Demo (Replit):** **[TO BE ADDED — V3.0 deployment pending]**  
> **Product Demo (YouTube):** **[TO BE ADDED — video in production]**  
> **Pitch Deck:** **[TO BE ADDED — slides in production]**

## 1. Overview

**SmartOrder Hub** is a proof-of-concept order consolidation and human-approval workflow for Malaysian micro and small businesses. It helps owners turn fragmented customer messages into structured orders, check inventory and supplier lead times, evaluate delivery feasibility and margins, and decide whether to accept, reject or request more information.

The workflow is **message intake → classification and extraction → catalog/stock/margin checks → explainable risk assessment → owner approval → order and purchase drafts → activity log and export**. Orders are **never accepted automatically**.

The interface supports **English, Simplified Chinese and Bahasa Melayu**. All seeded customer, product, supplier and order data is synthetic.

## 2. Key features

- **Unified Order Desk:** A review table showing customer, line items, order total, delivery details, stock signals, margin, risk band and recommendation. The seeded F&B demo classifies **34 synthetic messages**; **15 orders** enter the order table, while inquiries, advertisements, after-sales messages and other non-orders are filtered out.
- **Six-channel Channel Hub:** WhatsApp, Facebook Messenger, Instagram, Telegram, email and TikTok appear in one collection interface. **Five social connectors are deterministic demo adapters**, not live social-platform integrations. **Email supports a real read-only IMAP connection**, with Message-ID deduplication and optional background polling when configured.
- **Message understanding:** Optional AI-assisted classification/extraction, with deterministic rule extraction as a fallback. Bulk seeded intake defaults to rules for fast, reliable demos.
- **Explainable decisions:** Rules check required information, product matching, available stock, supplier lead time, delivery feasibility, revenue and gross margin. A five-factor weighted risk score covers **stock/capacity, delivery, margin, data completeness and anomalies**.
- **Risk visualizations:** Two donut charts summarize risk severity (**Low / Medium / High / Critical**) and the contribution of risk types. A short **AI/rule-based risk brief** identifies leading issues. High/Critical orders can open a detailed factor analysis.
- **Human-in-the-loop approvals:** A demo **Owner** can approve, reject or request information; **Staff** is view-only. Certain overrides require a written reason, and decisions are recorded in the activity log.
- **Operational outputs:** Approved orders, internal purchase drafts, activity history and **CSV/Excel export**.
- **Six industry profiles:** F&B, retail, wholesale, services, manufacturing and logistics, each with its own synthetic data, relevant fields, inventory/capacity semantics and risk weights.
- **Trilingual UI:** English, Simplified Chinese and Bahasa Melayu. Incoming customer messages and recorded backend/audit text are **not automatically translated**.

## 3. Demo walkthrough

The default synthetic business is **Kopi Kita Enterprise**, a coffee and kuih supplier.

1. **Stock shortfall, replenishment feasible:** An order for kopi and kuih exceeds available stock, but suppliers can replenish in time. The system recommends accepting with purchase drafts, subject to owner approval.
2. **Urgent delivery:** An order needs delivery before supplier replenishment is feasible. The system recommends rejection or negotiating a later date.
3. **Missing address:** A customer order lacks a required delivery address. The system recommends requesting more information instead of approving it.

These scenarios demonstrate the full journey from a raw message to an explainable recommendation, human decision and audit record.

## 4. What is real and what is simulated?

| Implemented in the prototype | Simulated or not yet integrated |
| --- | --- |
| React interface, FastAPI APIs, local JSON persistence | Production identity/SSO and multi-tenant authorization |
| Order classification, rule checks, risk scoring and audit log | Real SME inventory, payments and supplier purchase execution |
| Read-only IMAP email integration when configured | Live WhatsApp, Messenger, Instagram, Telegram and TikTok OAuth/API integrations |
| Optional AI extraction and risk brief, with rule fallback | AI processing of every bulk-intake message by default |
| Owner/Staff demonstration controls | Real Orbyte platform integration (currently a mock adapter) |
| CSV/Excel export and internal purchase drafts | Real purchase orders sent to suppliers |

The Orbyte adapter is an **integration boundary for future business data and approval workflows**, not a claim of live Orbyte connectivity. The demo uses synthetic data; do not enter real customer secrets or personal data.

## 5. AI usage and decision boundaries

The provider interface is implemented in [`ai_client.py`](src/v3.0/smartorder-hub/backend/app/ai_client.py). The project documents **DeepSeek Flash** as the default option and supports configurable compatible AI endpoints. Without a working API key—or if a provider times out or fails—message extraction falls back to deterministic rules.

**AI helps interpret message text; business rules calculate stock, lead time, revenue, margin and risk.** The owner makes the final decision. In the seeded bulk demo, the default intake mode is rules-based, even if an AI provider is configured.

Configuration and provider testing are available through **Settings → Connect AI API**. API keys belong in environment variables or Replit Secrets, **never in GitHub**.

## 6. Architecture and source code

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend | Python, FastAPI |
| Prototype storage | Local JSON store |
| Email | Read-only IMAP |
| AI | Configurable provider API with rule fallback |
| Deployment | Replit configuration and build/start scripts |

- **V3.0 application:** [`src/v3.0/smartorder-hub/`](src/v3.0/smartorder-hub/)
- **Detailed technical README:** [`smartorder-hub/README.md`](src/v3.0/smartorder-hub/README.md) — architecture, API, data model, risk policy and tests
- **Replit deployment instructions:** [`DEPLOY_REPLIT.md`](src/v3.0/DEPLOY_REPLIT.md)
- **Channel integration and security requirements:** [`CHANNEL-INTEGRATION.md`](src/v3.0/smartorder-hub/docs/CHANNEL-INTEGRATION.md)
- **Security audit and known limitations:** [`SECURITY-AUDIT.md`](src/v3.0/smartorder-hub/docs/SECURITY-AUDIT.md)

## 7. Quick start (local development)

**Prerequisites:** Python 3.11+, Node.js and npm. Run the following from the **repository root**.

**Backend — terminal 1:**

```bash
cd src/v3.0/smartorder-hub/backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

**Frontend — terminal 2 (from the repository root):**

```bash
cd src/v3.0/smartorder-hub/frontend
npm ci
npm run dev
```

Open **http://localhost:3000**. The frontend development server proxies `/api` to the backend on port **8000**.

To configure optional AI or email integration, refer to the [detailed technical README](src/v3.0/smartorder-hub/README.md). The core seeded demo can run without an AI key.

## 8. Replit deployment

The V3.0 repository contains deployment configuration and scripts. See [`DEPLOY_REPLIT.md`](src/v3.0/DEPLOY_REPLIT.md) for build, Secrets, port and Publishing instructions.

**Published V3.0 URL: [TO BE ADDED — not deployed at the time of this README update].** A temporary Replit preview is not a substitute for a verified published link.

## 9. Testing

The backend includes tests for order intake, decisions, risk calculations, channel and email behavior, industry switching, exports and safety checks. To run them after installing backend dependencies:

```bash
cd src/v3.0/smartorder-hub/backend
python -m pytest -q
```

The detailed README documents an **expected** result of **34 passed**. This is a documented expectation, **not a claim that the latest deployed build has been independently tested**.

## 10. Submission materials and project links

| Material | Link / status |
| --- | --- |
| Source repository | [Empathy-Coders on GitHub](https://github.com/Jacky-Godlike/Empathy-Coders) |
| Preliminary submission PDF | [SDC2026_Empathy Coders_Preliminary.pdf](submission/SDC2026_Empathy%20Coders_Preliminary.pdf) — confirm final content and portal submission |
| Live V3.0 Replit prototype | **[TO BE ADDED — deployment pending]** |
| Replit usage proof | **[TO BE VERIFIED — V1.0 proof exists; confirm final requirement]** |
| RunPod usage proof | **[TO BE CONFIRMED — only if applicable]** |
| Completed official submission template / PRD | **[TO BE VERIFIED — confirm which official template and final file]** |
| Technical & Tools Declaration | **[TO BE ADDED / VERIFIED — update for V3.0]** |
| Pitch deck | **[TO BE ADDED — in progress]** |
| YouTube product demo | **[TO BE ADDED — in progress]** |
| GitHub committee collaborator access | **[TO BE CONFIRMED — verify required accounts have access]** |
| Apache License 2.0 | [LICENSE](LICENSE) |

**Note:** A file's presence in the repository does not by itself confirm successful submission to the competition portal. Verify the official checklist and links before the deadline.

## 11. Team and Backend B contribution

**Team:** Empathy-Coders · Xiamen University Malaysia.

The `backend-b` branch contains a separate FastAPI module for message analysis, synthetic connectors and Excel export. The main V3.0 application adapted its **Excel workbook generation and formula-injection protection** and its **inquiry/after-sales message classification approach**. The original single-product `/analyze` endpoint was not merged because V3.0 supports multi-item orders; the branch remains available for reference.

## 12. License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE).
