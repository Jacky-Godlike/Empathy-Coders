# Empathy-Coders — SmartOrder Hub

**SDC Hackathon 2026 · Domain 2: Orbyte Smart SME Challenge**

SmartOrder Hub is a smart order consolidation and approval workflow for Malaysian
micro and small businesses. It takes orders from WhatsApp, email or manual entry,
extracts the fields, checks stock, supplier lead time, revenue and margin, and
routes the final decision to the owner. Every action is written to an activity
log.

The main screen is a **single order review table**: the intake engine classifies
34 synthetic messages (orders, inquiries, ads, after-sales, noise), and only the
15 real orders reach the table. Each row already contains the customer, items,
total, delivery, stock signal, margin, risk band and recommendation. The owner
confirms the row with one click on the far right; the raw inbox remains
available as an audit view.

The top of Order Desk also shows a **risk-mix donut** with the share of all
orders in the Low, Medium, High and Critical bands, plus counts and percentages
in the legend. Rows in the High or Critical bands get an **Analysis** button
that opens the full five-factor risk breakdown.

The top bar has an **identity switcher**: the Owner can confirm, reject or
request information; Staff is view-only and can still inspect every order and
its analysis. The interface uses a warm cream, terracotta and olive palette.

The left navigation adds **Order Desk, Inbox, Orders & purchases, Activity log,
Catalog & stock and Settings**. Settings includes an industry selector: F&B,
retail, wholesale, services, manufacturing and logistics each have their own
order fields, inventory semantics, risk weights and synthetic dataset. Stock,
profit and risk are always calculated by explicit rules; AI is only used to read
and extract the message.

**AI connection:** the provider seam is `smartorder-hub/backend/app/ai_client.py`
(`generate_json()`), with Gemini as the default and any OpenAI-compatible
endpoint as an alternative. In **Settings → Connect AI API** you can see the
provider, model, key variable and run a live **Test connection**. Replit
deployment files (`.replit`, `replit.nix`, `scripts/`) are included; see
[`DEPLOY_REPLIT.md`](DEPLOY_REPLIT.md) for the exact Secrets and publishing
steps.

The application lives in [`smartorder-hub/`](smartorder-hub/). See
[`smartorder-hub/README.md`](smartorder-hub/README.md) for the architecture, API, data
model, decision rules, demo script and run instructions.

## Quick start

```bash
# backend
cd smartorder-hub/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend (another terminal)
cd smartorder-hub/frontend
bun install
bun run dev
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
