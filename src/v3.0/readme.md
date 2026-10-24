# Empathy-Coders — SmartOrder Hub

**SDC Hackathon 2026 · Domain 2: Orbyte Smart SME Challenge**

SmartOrder Hub is a smart order consolidation and approval workflow for Malaysian
micro and small businesses. It collects messages from WhatsApp, Facebook
Messenger, Instagram, Telegram, email and TikTok, extracts the fields, checks
stock, supplier lead time, revenue and margin, and routes the final decision to
the owner. Every action is written to an activity log.

The interface is available in **English, Simplified Chinese and Bahasa Melayu**;
use the language selector in the top bar.

The main screen is a **single order review table**: the intake engine classifies
34 synthetic messages (orders, inquiries, ads, after-sales, noise), and only the
15 real orders reach the table. Each row already contains the customer, items,
total, delivery, stock signal, margin, risk band and recommendation. The owner
confirms the row with one click on the far right; the raw inbox remains
available as an audit view.

The top of Order Desk also shows two donuts. The first is the **risk-severity
mix** across Low, Medium, High and Critical orders. The second is the **risk-type
mix**: how much each factor (stock, delivery, margin, data, anomaly) contributes
to total weighted risk. A short **AI risk brief** highlights the top two risk
types and suggests operational improvements. Rows in the High or Critical bands
get an **Analysis** button that opens the full five-factor risk breakdown.

The sidebar has an **identity switcher**: the Owner can confirm, reject or
request information; Staff is view-only and can still inspect every order and
its analysis. The interface uses a warm cream, terracotta and olive palette.

The left navigation adds **Order Desk, Inbox, Channel Hub, Orders & purchases,
Activity log, Catalog & stock and Settings**. **Channel Hub** shows six social
and messaging connectors with connection state, sync actions and webhook paths.
The five social connectors use synthetic samples; the **Email** connector can
read a real IMAP mailbox through a read-only app-password connection and poll
for new mail automatically. Settings includes an industry selector: F&B,
retail, wholesale, services, manufacturing and logistics each have their own
order fields, inventory semantics, risk weights and synthetic dataset. Stock,
profit and risk are always calculated by explicit rules; AI is only used to read
and extract the message.

**AI connection:** the provider seam is `smartorder-hub/backend/app/ai_client.py`
(`generate_json()`). DeepSeek Flash is the default; the provider is detected
from the configured key/base URL, and Gemini or another OpenAI-compatible
endpoint can be used instead. In **Settings → Connect AI API** you can see the
provider, model, key variable and run a live **Test connection**. Replit
deployment files (`.replit`, `replit.nix`, `scripts/`) are included; see
[`DEPLOY_REPLIT.md`](DEPLOY_REPLIT.md) for the exact Secrets and publishing
steps.

The application lives in [`smartorder-hub/`](smartorder-hub/). See
[`smartorder-hub/README.md`](smartorder-hub/README.md) for the architecture, API, data
model, decision rules, demo script and run instructions. The production
requirements for WhatsApp/Meta/Telegram/TikTok OAuth, webhook signatures and
token storage are documented in
[`smartorder-hub/docs/CHANNEL-INTEGRATION.md`](smartorder-hub/docs/CHANNEL-INTEGRATION.md).
The five social connectors are deterministic demo adapters. The email connector
is a real read-only IMAP integration: configure it in **Channel Hub → Email
settings**, or set `EMAIL_IMAP_HOST`, `EMAIL_IMAP_USER` and
`EMAIL_IMAP_PASSWORD` in Replit Secrets for persistent auto-sync. Use a
dedicated test mailbox with synthetic messages for the hackathon.

## Quick start

```bash
# backend
cd smartorder-hub/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optional: edit thresholds / AI / webhook token
uvicorn app.main:app --reload --port 8000

# frontend (another terminal)
cd smartorder-hub/frontend
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Links

- Live prototype (Replit): _add after deployment_
- Pitching video (YouTube): _add before submission_
- Technical & Tools Declaration: _add before submission_
- Product Requirement Document: _add before submission_

## Team

Empathy-Coders · Xiamen University Malaysia

### Backend B contribution

The `backend-b` branch contains a second FastAPI module for message analysis,
synthetic connectors and Excel export. Its Excel workbook logic and its
after-sales/inquiry message taxonomy were adapted into the main application
(`smartorder-hub/backend/app/excel_export.py` and `extraction.py`). Its
single-product `/analyze` schema was not merged because SmartOrder Hub orders are
multi-item; the original module remains on `backend-b` for reference.

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
