# SmartOrder Hub

**Smart order consolidation and approval for Malaysian SMEs.**

SmartOrder Hub collects customer messages from WhatsApp, Facebook Messenger,
Instagram, Telegram, email and TikTok, turns them into reviewed order records,
checks the catalog, stock, supplier lead time, revenue and margin, then sends
the decision to the owner. Nothing is accepted automatically. Every step is
written to an activity log.

The interface is available in **English, Simplified Chinese and Bahasa Melayu**.
This is a proof of concept for **SDC Hackathon 2026, Domain 2: Orbyte Smart SME
Challenge**. All customer, product, supplier and order data is synthetic.

The workspace is industry-aware: **F&B, retail, wholesale, services,
manufacturing and logistics** each have their own order fields, inventory
semantics, risk weights and synthetic dataset. Stock, margin and risk are
calculated with explicit rules, never by the AI model.

---

## 1. The problem

A small shop receives orders through WhatsApp, email and a spreadsheet. The
owner has to copy the same details into another file, remember which item is
short, guess whether a supplier can deliver in time, and decide whether the
margin is worth taking. Missed messages and copy errors become missed sales.

SmartOrder Hub removes that copy-and-check loop while keeping the owner in control:

1. **Trigger** — a new message is pasted, imported or received.
2. **Connected data** — the catalog, stock, safety stock, supplier lead time and
   cost are pulled together.
3. **Decision logic** — deterministic rules check completeness, stock, delivery
   feasibility, revenue, profit and margin. AI is used only to read the message.
4. **Human approval** — the owner approves, rejects or asks for information.
5. **Visible outcome** — order record + purchase drafts + activity log + CSV/Excel.

---

## 2. Demo story

The seeded business is **Kopi Kita Enterprise**, a small coffee and kuih supplier
in Petaling Jaya.

The seed contains **34 raw messages**: 15 real orders, 4 inquiries, 4 ads,
4 after-sales messages, 4 other conversations and 3 uncertain messages. The
intake engine classifies all of them; only the 15 orders reach the table.

**The main screen is the order table, not a message feed.** Each row already has
the customer, items, total, delivery address/date, stock signal, margin, risk
band, AI recommendation and a **Confirm** button pinned to the far right. One
click is the owner approval; it creates the order record and any purchase
drafts. The Raw Inbox tab is a secondary audit view that shows how every message
was classified.

The left navigation mirrors an order desk:

| Section | What it is for |
|---|---|
| **Order Desk** | The clean order table; the primary demo screen |
| **Inbox** | Raw channel messages, classification and re-extraction |
| **Channel Hub** | WhatsApp, Messenger, Instagram, Telegram, email and TikTok collection |
| **Orders & purchases** | Approved records, purchase drafts and exports |
| **Activity log** | Every import, extraction, analysis, decision and draft |
| **Catalog & stock** | Products, safety stock, suppliers and lead times |
| **Settings** | Industry switch, AI connection, thresholds, roles, demo reset |

At the top of **Order Desk**, a risk-mix donut charts the share of all orders
in the four risk bands (Low, Medium, High, Critical), with counts and
percentages in the legend. It sits beside the intake summary cards and updates
after every intake or industry switch.

Rows in the **High** or **Critical** band also show a **View analysis** button.
It opens the same order modal used for review, with the five factor scores,
weights, weighted contribution, stock lines, margin and activity trail.

The sidebar **identity switcher** has two demo users:

- **Owner** — can confirm, reject or request information, and can override a
  blocker with a written reason.
- **Staff** — view-only: every order, stock check, margin, risk factor and
  activity event is visible, but no decision buttons are rendered.

The choice is stored in `localStorage`; the activity log records the owner's
name and role on every decision.

The F&B workspace is the default because it produces the richest stock,
lead-time and margin story. Settings can switch to the retail, wholesale,
services, manufacturing or logistics dataset; each one reloads its own
synthetic catalog, suppliers and 10-message inbox.

| Message | What SmartOrder Hub shows | What the human does |
|---|---|---|
| **Aisyah**: 240 kopi 3-in-1 + 30 kuih lapis, delivery in 4 days | Stock is short by 110 and 10, but both suppliers can deliver in time. Margin is 38.4%. Recommendation: **Accept with purchase draft**. | Owner approves; two purchase drafts and four log entries are created. |
| **Daniel**: 500 kopi, delivery tomorrow | Supplier needs 2 days + 1 buffer; the customer wants it in 1 day. Recommendation: **Do not accept**. | Owner can reject, or ask for a later date. |
| **Mr Lee**: 12 nasi lemak + 20 kaya toast, delivery, no address | Required field missing. Recommendation: **Request more information**. | Owner clicks "Request info"; SmartOrder Hub drafts a WhatsApp reply. |
| **Farah**: "Do you have teh tarik in stock?" | Not an order. | No order is created. |
| **Kak Mimi**: 100 teh tarik at RM1.00 each | Margin is 10%, below the 15% minimum. Recommendation: **Do not accept**. | Owner can override with a written reason; the override is logged. |

The first three cases are the ones to show in the 5–7 minute video.

---

## 3. What is real, what is simulated

| Real in this prototype | Simulated / mock |
|---|---|
| React UI, FastAPI API, JSON persistence | Login and identity provider |
| Six-channel inbox, connect/sync state, normalised webhook endpoint | Live OAuth, signed payloads and background polling for the five social channels |
| Real read-only IMAP email connector, Message-ID dedupe and email background poller | WhatsApp, Messenger, Instagram, Telegram and TikTok connectors (demo adapters) |
| Rule extraction with dates, quantities, addresses and aliases | AI extraction of every field; rules remain the fallback |
| English, Simplified Chinese and Bahasa Melayu UI | Translation of incoming customer messages or backend audit text |
| AI extraction and risk brief through DeepSeek Flash or another compatible API (optional) | Orbyte platform (mock adapter) |
| Stock, safety stock, supplier lead time, MOQ, margin math | Payment, e-invoice and statutory filing |
| Six industry profiles with synthetic per-industry datasets | Real industry benchmarks or customer records |
| Explainable five-factor risk score | Certified FMEA / credit model |
| Role-gated approval (owner / staff) | Multi-tenant organisation management |
| Activity log and CSV/Excel export | Real supplier purchase orders |

No real personal, customer or company data is used. No payment is processed.
Purchase drafts are never sent to a supplier.

---

## 4. Architecture

```
┌──────────────────────────────────┐
│ React 19 + TypeScript            │
│ Vite + Tailwind CSS 4            │
│                                  │
│ Order Desk · Risk mix pie        │
│ Inbox · Channel Hub              │
│ Orders & purchases · Activity    │
│ Catalog · Settings · EN/ZH/MS    │
└───────────────┬──────────────────┘
                │ /api (JSON)
┌───────────────▼──────────────────┐
│ FastAPI                          │
│                                  │
│ channels.py     ── six platforms │
│ ai_client.py    ── provider seam │
│ extraction.py   ── AI + rules    │
│ industries.py   ── 6 profiles    │
│ rules.py        ── stock /       │
│                    margin /      │
│                    lead time     │
│ risk.py         ── 5-factor      │
│                    scorecard     │
│ main.py         ── API           │
│ store.py        ── JSON db       │
│ orbyte_adapter  ── mock hub      │
└───────────────┬──────────────────┘
                │
        data/db.json
        (industry, catalog, suppliers,
         messages, orders, drafts, activity)
```

In development Vite proxies `/api` to FastAPI on port 8000. In production — and
on Replit — FastAPI serves the built `frontend/dist` and the API from one URL.

### Repository layout

```
smartorder-hub/
├── backend/
│   ├── app/
│   │   ├── main.py            # API routes, email poller and static hosting
│   │   ├── channels.py        # six channel definitions + demo sample bank
│   │   ├── email_connector.py # read-only IMAP connector + MIME parser
│   │   ├── ai_client.py       # provider-neutral AI seam + connection test
│   │   ├── extraction.py      # AI prompt + deterministic rule extraction
│   │   ├── industries.py      # six industry profiles and labels
│   │   ├── rules.py           # stock, margin, delivery-date checks
│   │   ├── risk.py            # explainable five-factor risk score
│   │   ├── risk_insights.py   # risk-type shares + AI/rule brief
│   │   ├── seed.py            # F&B synthetic seed
│   │   ├── industry_seed.py   # retail/wholesale/services/manufacturing/logistics
│   │   ├── excel_export.py    # .xlsx export (Backend B contribution)
│   │   ├── models.py          # request validation
│   │   ├── store.py           # atomic JSON store
│   │   ├── orbyte_adapter.py  # mock integration seam
│   │   └── config.py          # thresholds and env vars
│   ├── tests/test_flow.py     # end-to-end, industry/risk, channel and email tests
│   ├── .env.example           # local configuration template
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── MainSidebar.tsx
│       │   ├── ChannelHubView.tsx
│       │   ├── EmailConnectModal.tsx
│       │   ├── OrdersView.tsx
│       │   ├── RiskPieChart.tsx
│       │   ├── RiskTypePieChart.tsx
│       │   ├── RiskInsightCard.tsx
│       │   ├── CatalogView.tsx
│       │   ├── SettingsView.tsx
│       │   └── ...            # inbox, review modal, activity
│       ├── i18n/              # EN/ZH/MS dictionaries and provider
│       ├── services/          # fetch clients incl. channelsApi.ts and emailApi.ts
│       └── types/             # order, message, channel and email types
├── docs/
│   ├── CHANNEL-INTEGRATION.md # email API, OAuth/webhook and security checklist
│   └── SECURITY-AUDIT.md      # audit findings, accepted demo risks and debt
└── README.md
```

At the repository root, `DEPLOY_REPLIT.md`, `.replit`, `replit.nix` and
`scripts/` provide the one-command Replit build/run path.

### Channel collection

**Channel Hub** shows six connectors: WhatsApp Business, Facebook Messenger,
Instagram DM, Telegram Business, an order email inbox and TikTok Business. Each
card has a connection state, account, last sync, imported count, auto-sync
preference, sync action and webhook path. A demo notice makes the boundary
explicit.

- **Email is real.** Open **Channel Hub → Email settings**, enter an IMAP host,
  mailbox address and app password, test the connection, then save and sync.
  The connector is read-only, deduplicates by `Message-ID`, and polls in the
  background when auto-sync is on.
- **The five social connectors are simulated.** **Sync now** inserts one
  deterministic sample message from that platform.
- **Sync all channels** imports one message from every connected social channel
  and fetches new email when the mailbox is configured.
- Imported messages enter the same inbox, extraction, stock/margin/risk and
  owner-approval pipeline as manually pasted messages.
- `POST /api/channels/{id}/webhook` accepts normalised JSON and an optional
  `X-Webhook-Token`. Duplicate `source` + `externalId` pairs are ignored.
- Connecting, disconnecting and importing are written to the activity log.

Email credentials stay in server memory for the current session, or come from
`EMAIL_IMAP_*` environment secrets for auto-sync after a restart. They are
never returned to the browser or written to `db.json`. The social adapters do
not call platform APIs or perform OAuth. See
[`docs/CHANNEL-INTEGRATION.md`](docs/CHANNEL-INTEGRATION.md) for the email API,
endpoint contract, per-platform scopes and the production security checklist.

### Languages

The UI supports **English (default), Simplified Chinese and Bahasa Melayu**. Use
the language selector in the top bar (or the compact selector on mobile). The
choice is stored in `localStorage` under `smartorderhub.language` (the old
`orderflow_language` key is migrated once) and updates
`<html lang>`.

Translation files:

- `frontend/src/i18n/translations.ts` — shared base dictionary;
- `frontend/src/i18n/v2Translations.ts` — v2 screens and overrides;
- `frontend/src/i18n/I18nContext.tsx` — provider and fallback order;
- `frontend/src/components/LanguageSwitcher.tsx` — selector.

All static UI strings, including source/status/risk labels, are translated.
Incoming customer messages and backend-generated extraction/analysis/audit text
stay in the language in which they were recorded; this is deliberate for audit
fidelity, not a live translation feature. The coverage check can be repeated
with the team's i18n checker during development.

---

## 5. Run locally

### Backend

```bash
cd smartorder-hub/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optional: edit thresholds / AI / webhook token
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/api/health`:

```json
{"status":"ok","service":"smartorder-hub","aiMode":"rules-only","business":"Kopi Kita Enterprise"}
```

### Frontend

```bash
cd smartorder-hub/frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. Vite proxies `/api` to `http://localhost:8000`.

### AI API connection (optional)

The app works with **no AI key** because the deterministic rule extractor is
always available. To connect an AI provider, set environment variables in
`smartorder-hub/backend/.env` locally, or in **Replit → Tools → Secrets** for
deployment.

**DeepSeek Flash (default):**

```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=<secret>
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

The provider is auto-detected from the key and base URL. A stale
`AI_PROVIDER=gemini` does not override a DeepSeek key.

**Any OpenAI-compatible endpoint:**

```bash
AI_PROVIDER=openai
AI_API_KEY=<secret>
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Without a key, extraction uses the deterministic rule path. With a key, it
tries the provider first and falls back to rules on timeout, rate limit, a
malformed response or any exception. The UI shows whether the result came from
**AI** or **Rules**.

The **bulk intake defaults to `SMARTORDERHUB_INTAKE_MODE=rules`** so the
34-message demo is instant and never depends on a network call. Set it to
`auto` if you want the AI provider to read every message in the bulk pass. The
order table labels each row's extraction method (`AI` or `Rules`).

The provider call is isolated in `backend/app/ai_client.py`:

```python
# simplified from backend/app/extraction.py
def extract_message(text, sender, contact, products, mode="auto", industry=None):
    industry = industry or get_industry(None)
    if mode in ("auto", "ai") and ai_client.configured():
        try:
            return ai_extract(text, sender, contact, products, industry)
        except Exception:
            pass  # timeout, rate limit, bad JSON → deterministic fallback
    return rules_extract(text, sender, contact, products, industry)
```

`ai_client.generate_json()` is the only function that talks to a provider.
`extraction.ai_extract()` builds the industry-aware prompt, sends it through
that function, and maps the returned JSON into the order schema. To add a
provider, implement one function in `ai_client.py`; the rest of the pipeline
(catalog matching, stock, margin, risk, approval) is unchanged.

The key is read on the server only. **Settings → Connect AI API** shows the
provider, model, key variable, intake mode and a **Test connection** button.
The browser never receives the key. The full Replit walkthrough is in
[`DEPLOY_REPLIT.md`](../DEPLOY_REPLIT.md).

> Never commit `.env`. On Replit use the Secrets pane. The repository contains
> no API key.

---

## 6. Deploy on Replit

Replit is compulsory for this competition. The repository root already contains:

- `.replit` — Run button, deployment build/run commands and port mapping
- `replit.nix` — Python 3.11 and Node 22
- `scripts/build.sh` — install deps, type-check, build `dist`
- `scripts/dev.sh` — Run button: install/rebuild if needed, then start FastAPI
- `scripts/start.sh` — published deployment: start the built app

Steps:

1. Push the repository to GitHub and import it into Replit.
2. Press **Run**. The first run builds the frontend and starts FastAPI on port
   3000; Replit maps it to public port 80.
3. Add the AI key in **Tools → Secrets**:
   - DeepSeek Flash: `DEEPSEEK_API_KEY` (and optionally `DEEPSEEK_MODEL`)
   - OpenAI-compatible: `AI_PROVIDER=openai`, `AI_API_KEY`, `AI_BASE_URL`,
     `AI_MODEL`
4. Restart, open **Settings → Connect AI API** and click **Test connection**.
5. Use **Publishing** for the stable `*.replit.app` URL; the preview URL is
   temporary and private.

Full instructions, port troubleshooting and the security checklist are in
[`DEPLOY_REPLIT.md`](../DEPLOY_REPLIT.md).

Keep the Replit project link and the published live URL for the Technical &
Tools Declaration (section 3.2 and 10.6 of the participant handbook).

---

## 7. API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service status and AI mode |
| `GET` | `/api/workspace` | Business name, current industry, AI status, rules and counts |
| `GET` | `/api/industries` | The six industry profiles |
| `POST` | `/api/industry` | Switch industry and reload its synthetic dataset |
| `GET` | `/api/ai/status` | Whether an AI key is configured, provider/model and intake mode |
| `POST` | `/api/ai/test` | Make one tiny provider call to verify the key and model |
| `GET` | `/api/catalog` | Products, suppliers and stock for the current industry |
| `GET` | `/api/risk/insights` | Risk-type shares plus a short AI/rule-based improvement brief |
| `POST` | `/api/session/owner` | Validate the optional demo owner password before switching identity |
| `GET` | `/api/rules` | Current policy thresholds |
| `GET` | `/api/channels` | Channel connections and public state |
| `POST` | `/api/channels/{id}/connect` | Connect a channel |
| `POST` | `/api/channels/{id}/disconnect` | Disconnect a channel |
| `PATCH` | `/api/channels/{id}` | Update auto-sync preference |
| `POST` | `/api/channels/{id}/sync` | Import one social sample, or fetch new email when configured |
| `POST` | `/api/channels/sync-all` | Sync every connected channel, including email |
| `POST` | `/api/channels/{id}/webhook` | Normalised inbound message (optional token) |
| `GET` | `/api/email/status` | Password-free email connector state |
| `POST` | `/api/email/test` | Test the configured or supplied IMAP mailbox |
| `POST` | `/api/email/connect` | Test and keep session IMAP credentials |
| `POST` | `/api/email/sync` | Fetch new email into the inbox |
| `DELETE` | `/api/email/config` | Remove session IMAP credentials |
| `GET` | `/api/messages` | Raw inbox |
| `POST` | `/api/messages` | Add a WhatsApp / email / manual message |
| `POST` | `/api/intake/process` | Classify all unprocessed messages and fill the order table |
| `GET` | `/api/intake/summary` | Counts by message type and order status |
| `POST` | `/api/messages/{id}/extract` | AI or rule extraction (`mode: auto\|ai\|rules`) |
| `PATCH` | `/api/messages/{id}` | Staff status or notes |
| `DELETE` | `/api/messages/{id}` | Delete a message without an order |
| `POST` | `/api/messages/{id}/order` | Create an order draft from extracted fields |
| `GET` | `/api/orders` | Order list |
| `GET` | `/api/orders/{id}` | Order detail, analysis and purchase drafts |
| `POST` | `/api/orders/{id}/analyze` | Run stock, margin and delivery checks |
| `POST` | `/api/orders/{id}/decision` | `approve`, `reject` or `request_info` |
| `GET` | `/api/orders/{id}/activity` | Order + message timeline |
| `GET` | `/api/activity` | Global activity log |
| `GET` | `/api/orders/export.csv` | CSV export |
| `GET` | `/api/orders/export.xlsx` | Styled Excel export (one row per line item) |
| `POST` | `/api/demo/reset` | Reset to the synthetic seed |

### Decision request

Owner-gated requests must include the simulated demo identity headers:

```http
X-Demo-Role: owner
X-Demo-Actor: Demo Owner
```

```json
{
  "decision": "approve",
  "note": "Stock and margin checked.",
  "override": false
}
```

The dashboard exposes two identities: **Owner** can approve, reject or request
information; **Staff** is view-only. If the system recommends `REJECT`,
`REQUEST_INFO` or `NEEDS_REVIEW`, the owner can approve only with
`"override": true` **and** a written note. Missing required fields cannot be
approved at all.

The server reads the role and actor from `X-Demo-Role` / `X-Demo-Actor`; the
legacy body fields `role` and `actor` are ignored. Missing or unrecognised role
headers fail closed to Staff.

For a public demo, set `SMARTORDERHUB_OWNER_PASSWORD` in Replit Secrets. The
Owner switch then prompts for that password, and owner-only requests must send
`X-Owner-Password`; the password is kept in `sessionStorage`, not localStorage.
If the variable is empty, the demo is open. This is still a **simulated
demo RBAC**, not multi-user authentication. For a production deployment, put the
app behind Orbyte SSO or an authenticated reverse proxy. Owner-gated routes
include industry switch, demo reset, AI test, channel connect/disconnect/sync/
auto-sync, email test/connect/sync/disconnect and final order decisions.

---

## 8. Data model

`backend/app/data/db.json` is created on first run:

```json
{
  "meta": {"industry": "fnb", "businessName": "Kopi Kita Enterprise"},
  "suppliers": [{"id": "SUP-01", "name": "Sin Seng Trading", "leadTimeDays": 2, "moq": 100}],
  "products": [{"sku": "KOPI-3IN1", "name": "Kopi 3-in-1 Sachet", "aliases": ["kopi"], "sellPrice": 1.2, "unitCost": 0.75, "stock": 180, "safetyStock": 50, "supplierId": "SUP-01"}],
  "messages": [{"id": "MSG-0001", "source": "whatsapp", "status": "not_analyzed", "parsedData": null}],
  "orders": [{
    "id": "ORD-0001",
    "industry": "fnb",
    "industryFields": {"orderType": "delivery", "deliveryWindow": "before 3pm"},
    "status": "approved",
    "analysis": {"recommendation": "ACCEPT", "riskScore": 18.5, "riskBand": "Low", "riskFactors": []},
    "purchaseDrafts": []
  }],
  "activity": [{"id": "EVT-0001", "action": "order_approved", "actor": "Demo Owner"}]
}
```

`industryFields` is the only industry-specific part of an order. The core order
shape (customer, items, delivery, status, approval, purchase drafts) stays the
same, so the rule engine and the UI do not need a branch per industry.

Delete the file (or call `POST /api/demo/reset`) to re-seed.

---

## 9. Industry profiles

An industry profile is data, not a code fork. It changes four things:

1. the extra fields the extractor looks for (`industryFields`);
2. the labels used in the order table (items, date, stock, details);
3. which fields are required before approval;
4. the weights used by the risk score.

| Profile | Inventory model | Extra order fields | Required |
|---|---|---|---|
| **F&B / Bakery & Café** | stock | Order type, delivery window, cake message, allergens | — |
| **Retail & E-commerce** | stock | Variant, courier, payment status, tracking number, gift wrap | — |
| **Wholesale & Distribution** | stock | PO number, payment terms, delivery window, warehouse | PO number |
| **Services & Appointments** | capacity | Service, staff, appointment time, deposit, duration | — |
| **Manufacturing / Workshop** | material | Part number, material, tolerance, drawing revision, quality spec | Part number + material |
| **Logistics & Delivery** | capacity | Pickup, dropoff, weight, vehicle, cargo, volume, time window, handling | Pickup + dropoff + weight |

`inventoryMode` changes the meaning of the availability check:

- `stock` — finished goods: available = stock − safety stock.
- `material` — raw material: the same formula, but the catalog is material.
- `capacity` — slots or vehicle space: the catalog line is a capacity unit
  (for example a 1-tonne van), and a shortfall means the booking exceeds it.

Rules for extending the model:

- Add the field to the profile in `backend/app/industries.py`. Set
  `"table": true` to show it in the order table, and `"required": true` if a
  missing value must route the order to `REQUEST_INFO`.
- The rule extractor reads `Label: value` and any optional regex `pattern`.
  The AI prompt receives the same field list and must return the same keys, so
  switching providers does not change the order schema.
- Add synthetic messages to `industry_seed.py`; each profile ships with two
  suppliers, four to five products and ten messages (six orders, one inquiry,
  one ad, one after-sales, one other).

The selected profile is stored in `data/db.json` under `meta.industry`.
Switching profiles resets the demo store, so the UI never mixes two industries.

## 10. Decision policy

All thresholds live in `config.py` and can be set through environment variables.
They are business policy, not model output.

| Rule | Condition | Recommendation |
|---|---|---|
| Completeness | Missing customer, items, delivery date, or address for a delivery | `REQUEST_INFO` |
| Industry fields | A required industry field (PO number, cargo weight, material…) is missing | `REQUEST_INFO` |
| Catalog | A line cannot be matched to a SKU | `NEEDS_REVIEW` |
| Confidence | Extraction confidence < 70% | `NEEDS_REVIEW` |
| Lead time | Shortfall cannot arrive before the requested date | `REJECT` |
| Margin | Gross margin < 15% | `REJECT` |
| Replenishment | Shortfall, but supplier lead time + 1 buffer ≤ delivery window | `ACCEPT_WITH_PURCHASE` |
| Risk | Composite risk is High or Critical, but no earlier rule blocked | `NEEDS_REVIEW` |
| Default | Everything passes | `ACCEPT` |

**Available stock** = `stock − safetyStock`.
**Purchase quantity** = `max(shortfall, supplier MOQ)`.
**Gross margin** = `(revenue − product cost) / revenue`. The purchase cost is
shown separately because it is cash flow, not cost of goods sold.

---

## 11. Risk scorecard

The risk score answers a different question from the recommendation: not
"accept or reject?" but "how much exposure remains, and why?". It is a
transparent weighted scorecard in `backend/app/risk.py`.

```
score = Σ (factor_score × industry_weight)      # each factor is 0–100
```

Five factors:

| Factor | What raises the score |
|---|---|
| **Stock / capacity** | Shortfall ratio, a line that cannot be replenished in time, no catalog match, or cargo above vehicle capacity (floor 85) |
| **Delivery feasibility** | Days until delivery minus supplier lead time and the 1-day buffer; no date or a past date |
| **Margin** | Below the 20% comfort line (45), below the 15% minimum (85), or negative (100) |
| **Data completeness** | Each missing required field adds 32; low extraction confidence adds the gap below 70% |
| **Order anomaly** | Base 5, plus high value (+35), unknown customer (+25), possible duplicate within 3 days (+30), no service deposit (+70), capacity exceeded (+50) |

Bands: **Low 0–24**, **Medium 25–49**, **High 50–74**, **Critical 75–100**.

Two design choices keep the badge honest:

1. **Hard blockers floor the band.** A `REJECT` or `NEEDS_REVIEW` is at least
   High (50), and `REQUEST_INFO` is at least Medium (25). A low-margin reject can
   never display as "Low risk" just because most factors looked healthy. The
   API returns both `riskScore` and `rawRiskScore` so the UI can show that a
   floor was applied.
2. **The score never approves anything.** The recommendation comes from the
   explicit rules; the score only prioritises review and explains exposure.

Industry weights:

| Profile | Stock | Delivery | Margin | Data | Anomaly |
|---|---:|---:|---:|---:|---:|
| F&B | 30% | 25% | 20% | 15% | 10% |
| Retail | 30% | 20% | 20% | 15% | 15% |
| Wholesale | 30% | 25% | 15% | 10% | 20% |
| Services | 20% | 30% | 15% | 15% | 20% |
| Manufacturing | 25% | 25% | 15% | 20% | 15% |
| Logistics | 25% | 30% | 15% | 15% | 15% |

The method is adapted from established risk techniques rather than invented
from scratch:

- **FMEA / RPN** — failure mode and effects analysis scores severity,
  occurrence and detection, then multiplies them into a risk priority number
  (ASQ describes the standard approach: <https://asq.org/quality-resources/fmea>).
  SmartOrder Hub keeps the separation of impact and detectability but normalises
  each factor to 0–100 and uses weights, so the result is comparable across
  industries and does not grow without bound.
- **Safety stock and reorder point** — the availability check uses
  `available = stock − safetyStock`, and a shortfall is only acceptable when
  `leadTime + 1 buffer ≤ daysUntilDelivery`. This is the standard reorder-point
  idea applied per order rather than per replenishment cycle.
- **Weighted scorecard / risk matrix** — the 0–100 score and four bands follow
  the common credit-scorecard and risk-matrix pattern: define factors, weight
  them by business impact, set cut-offs, and keep every contribution visible.
  The weights live in `industries.py`, so a business can tune them without
  changing code.

References are included for the technique, not as a claim that this prototype
is a certified FMEA or credit model. The score is decision support for a human,
and the activity log records the human's decision separately.

## 12. Tests

```bash
cd smartorder-hub/backend
source .venv/bin/activate
pytest -q
```

Expected: **34 passed**. The suite covers:

- health and catalog;
- the full Aisyah flow, including two purchase drafts and the activity log;
- the risk score is the weighted sum of its five factors, with no floor applied
  to an acceptable order;
- urgent delivery → `REJECT`, with the risk floor at High or Critical;
- low margin → `REJECT`, with the risk floor at High or Critical;
- the 34-message intake: 15 orders created, 19 filtered out, exact type counts;
- only real orders reach the table (no ads/inquiries/unknown customers);
- missing address → `REQUEST_INFO` and a suggested reply;
- inquiry and after-sales messages → `not_an_order`;
- high-value order → owner warning;
- owner override requires a reason;
- Excel export row count and formula-injection protection;
- demo reset clears orders and restores 34 messages;
- the six channel connectors, reconnect state, demo sync, webhook ingestion,
  duplicate-id protection and disconnected-channel rejection;
- email MIME parsing, quoted-reply stripping and Message-ID generation;
- email status never exposes the password, and sync requires configuration;
- email connect → sync → deduplicate → disconnect through the API;
- the IMAP fetch path selects the mailbox read-only and parses messages;
- the email poller imports new mail when auto-sync is on and deduplicates the
  next poll;
- missing/staff demo role headers cannot reset the workspace or delete messages;
- CSV exports escape formula-injection prefixes, and invalid quantities are rejected;
- private IMAP hosts are blocked by default;
- all six industry profiles expose five risk weights that sum to 1;
- switching to wholesale changes the catalog, order fields and intake result
  (10 messages → 6 orders), and hard blockers keep their risk floor;
- AI status reports the rule fallback when no key is set, and the connection
  test is guarded with a clear error.

Frontend type check and production build:

```bash
cd smartorder-hub/frontend
npm ci
npm run lint
npm run build
```

---

## 13. Privacy, security and responsible use

The full audit, including accepted demo risks and technical debt, is in
[`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md).

- **Synthetic data only.** Names, phone numbers, addresses, companies and
  suppliers are invented.
- **No real payments or statutory filings.** Purchase drafts are internal drafts.
- **Human control.** No order is accepted without an owner decision.
- **Audit trail.** Every import, extraction, analysis, approval, rejection and
  purchase draft is recorded with actor, role and timestamp.
- **Demo RBAC, not authentication.** The server reads `X-Demo-Role` and
  `X-Demo-Actor` and fails closed to Staff. Set `SMARTORDERHUB_OWNER_PASSWORD`
  to require a password for the Owner switch and owner-only requests; even then,
  this is a single shared demo password. Do not expose a real customer dataset
  without Orbyte SSO or an authenticated reverse proxy in front of the app.
- **API keys** live in environment variables / Replit Secrets, never in Git.
  `.env` is ignored.
- **Browser CORS** is restricted to the configured local/dev origins
  (`SMARTORDERHUB_CORS_ORIGINS`), not `*`.
- **CSV and Excel exports** neutralise formula-injection prefixes; request
  bodies are size-limited and `parsedData` is capped.
- **Email SSRF guard.** The in-app email form only accepts public hosts on IMAP
  ports 143/993 by default, rejects private/loopback/link-local addresses, and
  skips oversized messages. Pin `EMAIL_ALLOWED_HOSTS` in production.
- **Local demo files.** `db.json` and the data directory are written with
  owner-only permissions where the OS supports it.
- **Channel credentials** must be stored server-side in environment variables or
  a secret manager. The browser only receives safe connection metadata. Email
  app passwords are held in process memory for the session or read from
  `EMAIL_IMAP_*` secrets; they are never returned by the API or written to
  `db.json`. Set `SMARTORDERHUB_CHANNEL_WEBHOOK_TOKEN` to require the
  `X-Webhook-Token` header; production social adapters must also verify each
  platform's signature.
- **If an AI API is enabled**, the message text is sent to the model provider.
  For a real deployment, mask phone numbers and addresses, set a retention
  period, obtain consent, and document the provider under Malaysia's PDPA
  principles. The demo does not send real personal data.
- **AI limits.** The model may misread a product name or quantity. The UI shows
  confidence and the extraction method; the rule checks use the catalog, not the
  model, for prices, stock and margin. A low-confidence result is routed to
  `NEEDS_REVIEW`.

---

## 14. Orbyte fit

`backend/app/orbyte_adapter.py` is the integration seam. In a real Orbyte
deployment:

| SmartOrder Hub method | Orbyte capability |
|---|---|
| `get_catalog()` | Shared business data / Open API |
| `get_inventory(sku)` | Inventory module / partner integration |
| `create_purchase_draft(...)` | Procurement or partner workflow |
| `request_approval(...)` | Workflow & approvals, roles and permissions |
| `emit_audit_event(...)` | Shared audit trail |

The same module can serve many SMEs: the catalog and policy are data, not code.
A future version could be listed in the Orbyte marketplace and priced per order
processed or per active SME, consistent with Orbyte's usage-based model.

---

## 15. Backend B integration

The `backend-b` branch contains a second FastAPI module written by a teammate.
Its README explicitly scopes it to message analysis, synthetic connectors and
Excel export; inventory, risk, approval, persistence and audit stay in Backend A.

**Integrated into this build:**

| Backend B contribution | Where it lives now |
|---|---|
| Excel workbook generation, styling and formula-injection protection | `backend/app/excel_export.py` and `GET /api/orders/export.xlsx` |
| Message taxonomy (order / inquiry / after-sales / other / uncertain) | `extraction.py` after-sales guard: refunds and complaints no longer become orders |

**Not merged, and why:**

- Backend B's `/analyze` schema is single-product. SmartOrder Hub orders can contain
  several line items, each with its own SKU, stock and supplier.
- Its connectors use generic stationery data. The main demo uses the Kopi Kita
  catalog so the stock, lead-time and margin story stays coherent.
- Its export/status fields assume a different schema. The workbook format was
  reused, but the rows are generated from SmartOrder Hub's multi-item orders.

The original module remains on the `backend-b` branch for reference. It can also
be mounted as a separate service if the team wants to demonstrate Backend B's
proposed two-service contract.

## 16. Known limitations / next steps

- Authentication and roles are simulated with a role selector. A production
  build would use Orbyte identity / SSO and real RBAC.
- The JSON store is single-process. A production build would use a database.
- The **five social channel connectors** are simulated demo adapters. They do
  not call live platform APIs, perform OAuth or verify platform signatures. The
  webhook route is real but expects normalised JSON.
- The **email connector is real read-only IMAP**, but it reads one mailbox and
  the newest `EMAIL_MAX_MESSAGES` messages; it does not persist IMAP UID state
  and does not download attachments. Session credentials are lost on restart;
  use `EMAIL_IMAP_*` secrets for persistent auto-sync.
- Social `autoSync` is a stored preference; only email has a background poller.
  See [`docs/CHANNEL-INTEGRATION.md`](docs/CHANNEL-INTEGRATION.md).
- The AI path is optional and depends on a provider; the rule path is the
  reliability fallback. Bulk intake is rule-based by default.
- The UI is trilingual, but incoming messages and backend-generated
  analysis/audit text are stored and displayed in their original language.
- The order table scrolls horizontally on narrow screens, but the **Confirm**
  column is pinned to the right so the one-click action stays visible.
- Purchase drafts stop at `draft`; no supplier is contacted.

---

## 17. Submission checklist

- [ ] Public GitHub repository with a real commit history
- [ ] Apache License 2.0 (`LICENSE`)
- [ ] Product Requirement Document (official template)
- [ ] Pitch deck
- [ ] Live Replit prototype URL
- [ ] Technical & Tools Declaration with Replit proof
- [ ] 5–7 minute YouTube pitching video with the prototype demo
- [ ] Committee GitHub accounts added as collaborators
- [ ] No API keys or secrets in the repository
