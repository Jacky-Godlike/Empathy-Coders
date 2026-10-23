# SDC2026 — Technical & Tools Declaration (draft)

> **How to use this file:** copy the relevant sections into the official
> `SDC Hackathon_ Technical Tools Declaration Template` PDF, complete every field,
> add the Replit proof screenshot, sign, and export as
> `SDC2026_<TeamName>_TechDeclaration.pdf`.
>
> This is the working Markdown draft. The final PDF is
> `submission/SDC2026_EmpathyCoders_TechDeclaration.pdf`. The leader contact and the exact Replit project URL are the only remaining
> placeholders; the live deployment URL is filled.
> The official deadline is **25 October 2026, 7:59:59 AM MYT**.

---

## 1. Team and project overview

| Field | Response |
| --- | --- |
| Team name | `Empathy Coders` |
| Project / solution name | OrderPilot — Smart Order Consolidation and Approval for SMEs |
| Name (leader) | `Yang Jiahui` |
| Email & phone (leader) | `[TO BE COMPLETED]` / `[TO BE COMPLETED]` |
| University affiliation(s) | `Xiamen University Malaysia (XMUM)` |
| Live prototype URL (Replit) | `https://order-pilot--microtopt.replit.app` |
| Code repository URL | `https://github.com/Jacky-Godlike/Empathy-Coders` (public; judges granted access) |
| Replit project | `<REPLIT_PROJECT_URL>` |
| RunPod | **Not used** — no GPU training, fine-tuning or inference |

---

## 2. Architecture and technology stack

### 2.1 System architecture overview (maximum 200 words)

*Approximate draft length: 170 words.*

OrderPilot is a Node.js/Express web application served by Replit. The browser UI (HTML/CSS/vanilla JavaScript) calls a REST API. The API orchestrates four services: triage, order/approval, inventory and activity. Triage sends synthetic message text to a server-side AI adapter, which calls the configured provider (DeepSeek `deepseek-flash` (V4.1 Flash) in the submitted demo) and returns a constrained JSON extraction. If the AI call fails or no key is configured, a deterministic rules extractor produces the same shape. The order service consolidates follow-up messages, matches the customer and catalogue, and calls a pure decision engine. The decision engine reads products, stock, suppliers and existing orders, then calculates stock availability, shortage, supplier lead-time feasibility, revenue, cost, gross profit, margin, price deviation, duplicates and missing fields. A human owner/manager approves; approval reserves stock and creates internal purchase drafts through a mock `OrbyteAdapter`. Every action writes an activity entry. Data is stored in JSON files (seed committed, runtime gitignored) behind a repository layer, so a SQLite/Postgres or real Orbyte implementation can replace it without changing the services.

### 2.2 Languages, frameworks and libraries

| Name & version | Type | Purpose in project | License |
| --- | --- | --- | --- |
| Node.js 20+ | Runtime | Server | MIT |
| Express 4.x | Framework | REST API, static hosting | MIT |
| ExcelJS 4.x | Library | XLSX exports | MIT |
| dotenv 16.x | Library | Local `.env` loading | BSD-2-Clause |
| HTML5 / CSS3 | Language | UI structure and design system | N/A |
| JavaScript (ES modules) | Language | Browser UI, server logic | N/A |
| Google Fonts: DM Sans, Fraunces | Font assets | UI typography | SIL Open Font License 1.1 |

All application code, the rules engine, the synthetic dataset and the UI were created by the team during the hackathon. The ExcelJS/dotenv/Express dependencies are used under their open-source licenses; their license texts remain with the packages and are not relicensed by this project. The repository's `LICENSE` is Apache 2.0 for the team's own code.

---

## 3. APIs and cloud services

### 3.1 External APIs

| API and provider | Purpose in project | Access tier |
| --- | --- | --- |
| **DeepSeek `chat/completions` API (OpenAI-compatible)** | Classify synthetic messages and extract order fields only. Not used for stock, margin or risk. | Team-paid / free tier |
| Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) | Web font delivery (DM Sans, Fraunces). The UI falls back to system fonts if unavailable. | Free |

No maps, payments, messaging, banking, government or real Orbyte APIs are called. The WhatsApp/email orders are synthetic messages pasted or uploaded into the app; no real WhatsApp/email API is connected.

**AI provider declaration:** the exact provider and model used at submission must be inserted here and in Section 4.1:

- Provider: `DeepSeek`
- Model: `deepseek-flash` (DeepSeek-V4.1-Flash)
- Why: OpenAI-compatible structured extraction, available in Malaysia, low latency

The submitted demo runs with DeepSeek. The deterministic rules fallback remains available and is labelled in the UI if the provider is unavailable.

### 3.2 Cloud platforms and deployment

| Service and provider | Purpose in project | Plan / region |
| --- | --- | --- |
| Replit | Development, runtime, Secrets, deployment, Webview | Replit Core (sponsor-provided credit) |
| GitHub | Public source repository, commit history, Apache 2.0 license | Free |
| AI provider | Server-side inference API | `<free tier / paid>` |

The app is deployed with Replit Deployments from the GitHub repository. The `.replit` file runs `npm start` (Node 20). Static assets and the API are served by Express; there is no separate build step. Runtime JSON data is created on boot from the committed seed. No cloud database, object storage, authentication service or payment service is used.

---

## 4. AI tools, models and datasets

### 4.1 AI models used in the solution

| Model & version | Source / provider | Usage | License / terms |
| --- | --- | --- | --- |
| `deepseek-flash` (DeepSeek-V4.1-Flash) | `DeepSeek` | Pre-trained; called via API for message classification and field extraction. Not fine-tuned or self-trained by the team. | Provider API terms |
| Deterministic rules extractor | Team-created code | Fallback classification/extraction when the AI is unavailable or returns invalid output | Team code, Apache 2.0 |

The AI model is not used to decide stock, margin, delivery feasibility, duplicates or approval. It returns structured fields; the server validates them against the catalogue and the decision engine recalculates every business rule. The model does not receive real personal data; all demo messages are synthetic.

### 4.2 Datasets

| Dataset name | Type | Source / URL | Personal data? | License |
| --- | --- | --- | --- | --- |
| OrderPilot synthetic SME seed | Synthetic | Team-created JSON in `data/seed/` | No (fictional names, phones, emails and addresses) | Team-created; Apache 2.0 with the repository |
| OrderPilot synthetic message test set | Synthetic | Team-created; 29 WhatsApp/email-style messages | No | Team-created; Apache 2.0 with the repository |
| Google Fonts | Font assets (not training data) | `fonts.google.com` | No | SIL OFL 1.1 |

No public or private dataset was used for training, fine-tuning or evaluation of the AI model. No real customer, supplier, company or Orbyte data is included. The synthetic messages cover clear orders, Malay/Manglish, add-ons, corrections, ads, inquiries, supplier pitches, payment reminders and spam.

### 4.3 AI-assisted development tools

Did the team use generative-AI tools to help create code, design, text or other project material?

**Yes.**

| Tool & version | Used for | Extent of use |
| --- | --- | --- |
| Claude Code (Anthropic) | Code scaffolding, implementation review, debugging, documentation drafts, UI design support | Moderate / major — the team directed the architecture and reviewed every file |
| No other generative-AI development tool declared | None | None |

*The team must remove tools they did not use and add any they did. Undeclared use can affect eligibility.*

**How the team reviewed, tested and took responsibility for AI-generated output (maximum 100 words):**

> The team defined the problem, the five-step journey, the recommendation rules and the approval model before using AI assistance. Every generated file was read, adapted and tested. We ran the 42-test suite and manually exercised the desktop and mobile UI, including the scan, consolidation, approval, request-info, staff-403, export and reset flows. We can explain the architecture, the decision rules, the AI/fallback split and the data model. AI was a productivity assistant; the problem framing, solution design and technical decisions are the team's.

---

## 5. Sponsor-provided resources

Did the project use any official SDC sponsor-provided resource?

**Yes — Replit Core.**

| Sponsor | Resource | How it was used |
| --- | --- | --- |
| Replit | Replit Core credit (US$20) | Development, runtime, Secrets, deployment and live demo URL |
| RunPod | US$25 credit | **Not used.** The project has no GPU workload: no training, fine-tuning or GPU inference. The AI model is called as a hosted API. |
| Orbyte (Alpha Red) | Platform access / dataset | **Not used.** No production Orbyte access, API or customer data was provided or used. A mock `OrbyteAdapter` models the future integration over synthetic data. |

**Was the sponsor resource essential to the core functionality, or could it be replaced?**

*Approximate draft length: 80 words.*

> Replit is required by the competition and is used for the live prototype and deployment; the application can also run locally with `npm start`, so the business logic is not locked to Replit. RunPod is not used because there is no GPU workload. Orbyte production access is not used; the `OrbyteAdapter` interface is the integration seam, and the mock implementation is replaceable by a real Orbyte Connect adapter without changing the order desk.

### Replit proof of use (required)

Insert **one** of the following, from the team's own account/project:

- [ ] Live deployment URL: `https://order-pilot--microtopt.replit.app`
- [ ] Replit project link with project history: `<REPLIT_PROJECT_URL>`
- [ ] Screenshot of finished Replit credit (team account and project visible)

**Screenshot:** insert `submission/SDC2026_EmpathyCoders_ReplitProof.pdf` below. It must show the team's own Replit account/project, the project name and the deployment/URL. Do **not** show the AI key value.

> The organisers will verify the proof. An inaccessible, private or someone-else's project may make the submission ineligible.

---

## 6. Security, privacy and responsible use

### 6.1 Data handling and privacy (maximum 150 words)

*Approximate draft length: 130 words.*

> The demo stores only synthetic customer, product, supplier, stock, message, order and activity records created by the team. No real personal, customer or company data is collected. The AI provider receives the synthetic message text and the synthetic catalogue context needed for extraction; the API key is held server-side in Replit Secrets (or a gitignored `.env` locally) and is never sent to the browser, logged or committed. The demo runtime data is stored in JSON files and lasts until the manager resets the demo; the reset is logged. A real deployment would apply PDPA principles: purpose limitation, data minimisation, a retention schedule, role-based access, encryption in transit, a data subject request process and a documented cross-border transfer basis. No real payments, statutory filings or supplier purchase orders are processed.

### 6.2 Known limitations and risks (maximum 150 words)

*Approximate draft length: 135 words.*

> **AI hallucination or omission.** The model may miss or invent a field. Mitigation: a strict JSON schema, catalogue validation, confidence scoring, mandatory missing-field checks, deterministic re-calculation of every business number, a visible source message, and human approval. **Provider dependency and rate limits.** Mitigation: timeout, one retry, per-message fallback to the deterministic extractor, and a UI/label that states which mode ran. **Single-process JSON storage.** Mitigation: a repository interface; a SQLite/Postgres store is the production path. **Simulated authentication.** The actor header is a demo device; the server still enforces roles. A real deployment would use Orbyte SSO and signed sessions. **Replit Autoscale persistence.** The demo reseeds on boot; a Reserved VM or external database is the production path. **Scope.** The app does not process payments, send real purchase orders, or give legal/financial advice.

---

## 7. Compliance and readiness checklist

- [ ] All APIs, cloud services, AI tools, models and datasets used in the project are declared in this document.
- [ ] All third-party code, datasets and models are used in accordance with their licenses, and attribution is provided where required.
- [ ] No API keys, passwords or other credentials are exposed in the code repository, prototype or this document.
- [ ] Any use of generative-AI tools for development has been disclosed and reviewed by the team.
- [ ] Any use of official SDC sponsor resources has been declared in Section 5.
- [ ] The prototype is accessible to judges through the links in Section 1.
- [ ] The Replit proof of use is included.
- [ ] RunPod is declared as not used (no GPU workload).
- [ ] All fields in this template are completed within the word limits.
- [ ] The team can explain every major component, including AI-assisted code, during judging.

---

## 8. Declaration

By submitting this document, the team leader confirms that the information provided is complete and accurate to the best of the team's knowledge, and that every API, cloud service, AI tool, dataset, model and sponsor resource used in the project has been declared.

**Signature:** __________________________

**Name:** `Yang Jiahui`

**Date:** `21 October 2026`
