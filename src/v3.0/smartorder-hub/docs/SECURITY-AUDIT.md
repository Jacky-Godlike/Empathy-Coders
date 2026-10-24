# SmartOrder Hub — security and maintainability audit

Audit date: 2026-10-24  
Scope: every source, test, deployment and documentation file in
`smartorder-hub/`, plus the root Replit scripts and submission files.

This is a hackathon MVP with synthetic data. It is **not** a production
multi-tenant system. The audit separates issues that were fixed from risks that
are explicitly accepted for the SDC demo.

---

## 1. Fixed in this pass

| Severity | Issue | Fix |
|---|---|---|
| High | Owner-only actions trusted `role`/`actor` from the JSON body | Server now reads `X-Demo-Role` / `X-Demo-Actor`; body fields are ignored. Missing or unrecognised roles fail closed to Staff. |
| High | Fresh browser defaulted to Owner | `loadStoredUser()` now falls back to Staff. The switcher remains a demo affordance, not authentication. |
| High | Demo identity could be self-asserted | Optional `SMARTORDERHUB_OWNER_PASSWORD`: owner switch prompts, sends `X-Owner-Password` (constant-time), and keeps it in `sessionStorage`. Leave unset only for an open demo. |
| High | IMAP TLS certificate verification was disabled by Python's default IMAP context | `ssl.create_default_context()` is passed to `IMAP4_SSL` and `starttls`; certificate/hostname failures are fatal. |
| High | HTML email stripping used a catastrophic-backtracking regex | Replaced with a linear `html.parser.HTMLParser` text extractor and a 200 KB HTML input cap. |
| High | `NaN`/`Infinity` or non-string `parsedData` could persist and break JSON/Excel/risk | `parsedData` validation rejects non-finite JSON; `db.json` writes use `allow_nan=False`; order strings/industry fields are coerced and length-bounded; Excel sanitises non-strings. |
| High | Slow AI calls held the global JSON-store lock | `/extract` and `/intake/process` now run extraction on a snapshot outside the lock and apply results atomically with an industry-change recheck. |
| High | Staff could overwrite extracted fields via `PATCH parsedData` | Only Owner may submit `parsedData`; the activity log records “Owner corrected the extracted fields.” |
| Medium | Staff could open the mailbox credential modal | Modal is owner-only in the UI; all email write endpoints also require the owner role/password. |
| High | CORS allowed every origin | `CORSMiddleware` now uses `SMARTORDERHUB_CORS_ORIGINS` (local Vite/preview origins by default), not `*`. |
| High | SPA fallback could serve a file outside `frontend/dist` via `..` | Candidate paths are resolved and must be relative to the resolved `dist` root. |
| High | CSV export was formula-injection prone | All user-controlled CSV cells go through the same `safe_cell()` rule as the Excel export. |
| High | Email form allowed arbitrary IMAP host/port (SSRF/port scanning) | Public hosts only by default, IMAP ports 143/993, optional `EMAIL_ALLOWED_HOSTS` allowlist; non-global IPs (private, loopback, link-local, CGNAT, reserved) are rejected. |
| High | Email fetch downloaded complete messages including large attachments | `EMAIL_MAX_MESSAGE_BYTES` (default 1 MB) is checked with `RFC822.SIZE` before downloading; bodies are still capped at 5,000 characters. |
| Medium | `PATCH /api/messages/{id}` accepted unbounded `parsedData` | Request bodies are size-limited (`SMARTORDERHUB_MAX_REQUEST_BYTES`, default 1 MB); `parsedData` is capped at 50 KB; order items are capped at 50 and quantities at 100,000. |
| Medium | Negative/non-numeric/huge quantities and prices could reach the rule engine | `_build_order`, `rules.py`, `risk.py` and the AI extraction path now use finite, bounded conversions and reject invalid quantities. |
| Medium | Webhook token compared with `!=` | `hmac.compare_digest()` is used. |
| Medium | `db.json` could be world-readable | Data directory is chmod `0700`; the atomic temporary file is chmod `0600` before replacement. |
| Medium | AI prompt accepted instructions inside customer messages | System/user prompts now state that message content is untrusted data; output is still parsed/validated by rules. |
| Medium | Raw provider exception could reach the browser | Unexpected AI test failures return a generic 502; details stay in server logs. |
| Medium | `ai.keyUrl` could be a `javascript:` URL | Settings only renders the key link for `http:`/`https:` URLs. |
| Medium | Email Test could test saved credentials while the form showed edited values | Test requires the app password when host/username/mailbox/SSL changed, and always tests the submitted form. |
| Medium | Language switch wiped the email password field | Fetch effect depends only on modal open state; password is cleared on close. |
| Medium | Channel Hub could start overlapping syncs | A ref-based action lock prevents concurrent channel actions; email imports also update the recent-imports panel. |
| Medium | Stale `dist` could be served after source changes | `dev.sh` rebuilds when frontend sources are newer than `dist/index.html`; `build.sh` runs type-check + build; `start.sh` fails if `dist` is missing. |
| Low | Unused legacy `Sidebar.tsx` | Removed. |
| Low | Stale `OrderFlow` strings and storage key | Active strings changed to SmartOrder Hub; language key migrated from `orderflow_language` to `smartorderhub.language`. |
| Low | Stale `bun.lock`/`metadata.json` and non-reproducible npm builds | Added `package-lock.json`, use `npm ci`, removed stale lock/metadata, added `license` to `package.json`. |
| Low | `.gitignore` data paths did not match the nested app directory | Changed to `**/backend/app/data/` and `**/backend/.tmp-data/`. |
| Low | Hard-coded “Kopi Kita Enterprise” in suggested replies | Uses the current workspace/industry business name. |

Regression tests were added for role enforcement, CSV escaping, invalid
quantities, private-host rejection, email parsing/fetch/poller and password-free
status, optional owner-password enforcement, non-finite `parsedData`, Staff
`parsedData` rejection and linear HTML stripping. The backend suite is **34 passed**.

---

## 2. Accepted limitations (do not treat as secure production auth)

| Risk | Why accepted for SDC | Production action |
|---|---|---|
| `X-Demo-Role` is self-asserted when `SMARTORDERHUB_OWNER_PASSWORD` is empty | Domain 2 explicitly allows simulated login/RBAC; the data is synthetic and no real payment/PO exists. The optional owner password is enforced when configured. | Set the owner password for a public demo, and put production behind Orbyte SSO or an authenticated reverse proxy. |
| Anyone can set `X-Demo-Role: owner` and reset the demo when no owner password is configured | Same demo boundary; reset is a judged demo feature. | Set `SMARTORDERHUB_OWNER_PASSWORD`; remove/disable reset in production. |
| Webhook token is optional (empty by default) | Local demo must work without provisioning a secret. | Set `SMARTORDERHUB_CHANNEL_WEBHOOK_TOKEN` to a long random value before publishing. |
| IMAP host validation can still be bypassed by DNS rebinding | The host is revalidated before every connection, but a hostname can re-resolve between validation and TLS connect. | Pin `EMAIL_ALLOWED_HOSTS` and resolve/connect to a validated IP in production. |
| Email fetch has no persistent UID cursor | The connector uses UID SEARCH/FETCH and `Message-ID` dedupe, but only reads the newest `EMAIL_MAX_MESSAGES`; a burst larger than that can leave older mail unimported. | Persist `UIDVALIDITY + last UID` per mailbox and page through all new mail. |
| Read endpoints and exports are unauthenticated | The judged dataset is synthetic; hiding read-only demo data would add no real protection. | Put all `/api` routes behind real auth/tenant scoping before using real customer data. |
| Predictable sequential IDs (`ORD-0001`) | Convenient for the demo and audit references. | Use UUIDs and enforce object-level authorization in production. |
| JSON store is file-locked but still not a database | The hackathon brief allows JSON; it is inspectable and reset-friendly. A process lock prevents most multi-writer races but does not replace transactions/backups. | Replace with a database and a real queue. |
| Session email credentials are lost on restart | In-app connect flow is for the demo; Replit Secrets are the persistent path. | OAuth/refresh tokens in a secret manager; encrypted at rest. |
| No rate limiting on expensive endpoints | Demo traffic is low; adding a distributed limiter would be infrastructure. | Add gateway/API rate limits, especially `/api/ai/test`, `/api/email/test`, `/api/intake/process`. |
| Request-size check uses `Content-Length`; chunked bodies can bypass it | Replit/proxies can enforce `client_max_body_size`; the demo is not a public multi-tenant service. | Enforce the byte limit in the ASGI receive loop or at the reverse proxy. |
| No attachment/voice/image parsing | The order journey uses text; attachments are metadata only. | Add a malware-scanned attachment pipeline. |
| No real email OAuth | IMAP app passwords are the quickest cross-provider path. | Add Gmail API / Microsoft Graph OAuth adapters if the provider blocks IMAP. |
| `db.json` still contains synthetic data in the working folder | It is gitignored and excluded from the submission zip; the app seeds on first run. | Never ship a populated store to a public deployment. |

---

## 3. Maintainability judgement

Kept because they are necessary:

- `main.py` route layer, channel/email helpers, approval and purchase-draft flow.
- `extraction.py`, `rules.py`, `risk.py`, `risk_insights.py`: the explainable
  decision engine; AI is only an optional extraction path.
- `seed.py` / `industry_seed.py`: synthetic datasets and industry profiles.
- Six-channel and mailbox UI, order desk, activity log and exports.

Removed or simplified:

- legacy `Sidebar.tsx` (unused; `MainSidebar` is the live component);
- stale `bun.lock` / `metadata.json`;
- duplicate `fetchIndustries()` client;
- unused icons/constants/imports;
- body-based role handling (now server-header based).

Known technical debt (not rewritten because it is working and time-boxed):

- `main.py` is a large route module; splitting into `routers/` would improve
  navigation but is not required for the MVP.
- `OrdersView.tsx`, `OrderReviewModal.tsx`, `AddMessageModal.tsx` and
  `SettingsView.tsx` are large. Shared `Modal`, `DonutChart`, `RiskBadge`,
  `format.ts` and `UserSwitcher` components would reduce duplication.
- `OrderItem` is defined in both `types/order.ts` and `types/message.ts` with
  different shapes; rename one before a larger refactor.
- CSV batch import is sequential and not transactional; a failed row can leave
  earlier rows persisted. A bulk endpoint with idempotency keys is the next
  improvement.
- The order decision is intentionally one click. If this becomes a production
  workflow, add a confirmation/step-up approval.

---

## 4. Verification commands

```bash
cd smartorder-hub/backend
pytest -q                       # 34 passed

cd ../frontend
npm ci
npm run lint                    # tsc --noEmit
npm run build                   # Vite production bundle
```

Manual checks:

- open `/` from the built app and confirm the SPA loads;
- request `/api/email/status` and confirm no password field is returned;
- send owner-only requests without `X-Demo-Role` and confirm `403`;
- download CSV with a customer name beginning `=` and confirm Excel shows text;
- set `EMAIL_ALLOW_PRIVATE_HOSTS=false` and confirm `127.0.0.1` is rejected.
