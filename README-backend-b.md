# SDC Hackathon 2026 — Backend B

Standalone FastAPI module for the Domain 2 synthetic SME order intake demo. **Backend A owns inventory, risk, approvals, persistence, and audit logs.** Backend B never approves orders. This is a prototype, not a production personal-data system.

## Windows quick start (Python 3.11 or 3.12)

Open the project root folder (`SDC_Backend_B`) in VS Code or PowerShell. In the terminal:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-backend-b.txt
.venv\Scripts\python.exe -m uvicorn src.backend_b.main:app --reload --port 8001
```

If Python 3.12 is installed instead, replace `py -3.11` with `py -3.12`. The command must be executed in the directory containing `src`, `tests` and `requirements-backend-b.txt`.

Open http://127.0.0.1:8001/docs for Swagger UI, or http://127.0.0.1:8001/health for `{"status":"ok","service":"backend_b"}`. Stop the server using Ctrl+C.

## Test

Open a **second terminal** in the same project root:

```powershell
.venv\Scripts\python.exe -m pytest -q
```

Swagger: expand `POST /analyze` → Try it out → enter:

```json
{"message":"Hi, I want to order 10 notebooks for RM5 each.","source":"whatsapp","message_id":"msg_001"}
```

Expected key values: `message_type=order`, `quantity=10`, `unit_price=5.0`, `extraction_method=fallback` without AI configuration; absent customer fields are `null`.

Try `GET /connectors/messages?source=email&limit=2`, `GET /connectors/suppliers`, and `GET /health` in Swagger. For Excel, expand `POST /export`, Try it out, enter:

```json
{"orders":[{"order_id":"ORD-001","customer_name":"Demo Customer","product_name":"notebook","quantity":10,"unit_price":5,"status":"READY_FOR_APPROVAL","risk_level":"LOW"}]}
```

Click Execute. Swagger may show a download link, or use the following PowerShell command from the project root to save the file:

```powershell
$body = '{"orders":[{"order_id":"ORD-001","product_name":"notebook","quantity":10,"unit_price":5}]}'
Invoke-WebRequest -Uri http://127.0.0.1:8001/export -Method Post -ContentType 'application/json' -Body $body -OutFile orders.xlsx
```

Open `orders.xlsx` in Excel; check headers and the first order row. This local output is ignored by Git.

## Routes and contract

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Health JSON |
| GET | `/connectors/messages` | Synthetic messages; `source=all/whatsapp/email`, `limit=1..100` (default 50). `total` is the filtered count **before** limit. |
| GET | `/connectors/suppliers` | Synthetic supplier records |
| POST | `/analyze` | Classification/extraction; all nullable fields always present |
| POST | `/export` | `.xlsx` download, max 2000 orders; empty array is rejected |

Invalid inputs return HTTP 422 `{"detail":"Invalid request","error_code":"VALIDATION_ERROR"}`. Unknown paths use FastAPI's standard 404 response. Input message max 5000 characters. The export accepts the seven specified columns, ignores extra order fields, allows missing/null columns, and rejects negative price and nonpositive quantity. No filesystem paths are returned. Excel is generated in memory and not stored server-side. Workbook formulas are neutralized by escaping suspicious text.

`missing_fields` lists absent customer name/phone, product, quantity, unit price, address, and requested delivery date **for orders**; for non-orders it is empty. This is an extraction-completeness list, not Backend A's business-risk policy. The `confidence` field in fallback is a heuristic label, not calibrated statistical confidence.

## Optional AI (requires an external paid/free API account)

Copy `.env.example` to `.env` (never commit `.env`). Set:

```dotenv
AI_PROVIDER=openai_compatible
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=YOUR_SUPPORTED_MODEL_NAME
AI_API_KEY=YOUR_SECRET_KEY
AI_TIMEOUT=12
```

Use the model and compatible endpoint actually supported by your provider. Calls use `httpx` and the `/chat/completions` JSON format. This does not use a ChatGPT Plus subscription automatically. Without credentials, `AI_PROVIDER=none`, or on API/network/JSON/schema failure, `/analyze` uses local **fallback**; connectors, Excel, Swagger, and all other routes work offline. Fallback recognizes common notebook/pen/folder phrases, Chinese order keywords, RM amounts and ISO dates, but does **not** provide general-purpose natural language understanding or robust relative-date parsing. AI responses undergo schema checks and conservative evidence checks; not all hallucinations can be eliminated, so Backend A must treat results as unverified suggestions.

## Backend A integration (proposed contract, NOT yet jointly verified)

Backend A runs at `http://127.0.0.1:8000` and Backend B at `http://127.0.0.1:8001`. Backend A should make server-to-server HTTP calls:

```python
import httpx

async def analyze_customer_message(message: str, message_id: str):
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post("http://127.0.0.1:8001/analyze", json={"message": message, "message_id": message_id, "source": "whatsapp"})
        r.raise_for_status()
        return r.json()

async def get_suppliers():
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get("http://127.0.0.1:8001/connectors/suppliers")
        r.raise_for_status()
        return r.json()

async def export_orders(orders: list[dict]):
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post("http://127.0.0.1:8001/export", json={"orders": orders})
        r.raise_for_status()
        return r.content  # Backend A returns this as an xlsx response to its frontend
```

For Backend A's proposed `GET /orders/export`, return the bytes with MIME type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and a `Content-Disposition: attachment; filename="orders.xlsx"` header. Backend B does not implement this Backend A endpoint.

### Items the team must confirm

1. Field names, enum values and date formats in Backend A's actual schemas.
2. `missing_fields` business meaning and which fields Backend A truly requires.
3. Supplier product-name normalization and whether multiple suppliers per product are supported.
4. Export status/risk enums and whether Backend A sends additional columns (extra columns are currently ignored).
5. Whether Backend A or the frontend fetches the synthetic message feed; current design assumes Backend A handles browser-facing integration.
6. How Backend A handles `uncertain`, API timeouts, and null values.

## Troubleshooting

- `py` not recognized: install Python 3.11/3.12 from python.org, select Add Python to PATH, reopen terminal.
- `No module named ...`: run pip install above, with the `.venv` interpreter.
- `No module named src`: run from the project **root**, not `src/backend_b`.
- Port 8001 in use: stop other uvicorn instance; coordinate before changing ports.
- Swagger inaccessible: check that uvicorn says running at `127.0.0.1:8001`.
- `422`: verify JSON quotes, message is nonblank, valid source and positive quantity.
- AI always says `fallback`: check `.env`, restart server, verify API provider/model/key and network; fallback is intentional when AI fails.
- `ModuleNotFoundError pytest`: reinstall requirements into the same Python environment.

## GitHub integration

Copy `src/backend_b` and `src/__init__.py` into the team's `src/` folder without overwriting existing files. Copy tests into the team's `tests/` folder only after checking for filename collisions. Keep `requirements-backend-b.txt`, `.env.example`, and this README under a nonconflicting name at repo root or a team-approved location. **Merge** ignore entries into existing `.gitignore`, never overwrite it. Do not upload `.env`, virtual environments, Excel outputs, or API keys. Do not commit/push without approval.

## Limitations

No real WhatsApp, email, supplier integrations, payment, authentication, or persistence. Synthetic data only. No real AI network test was run as part of the offline suite. This module was built separately because the team's GitHub repository and Backend A schemas were not supplied. Production deployment would require authentication, authorization, privacy/PDPA review, rate limiting, and secure transport.
