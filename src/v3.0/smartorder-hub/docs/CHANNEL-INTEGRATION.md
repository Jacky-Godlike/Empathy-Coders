# Channel collection and integration guide

SmartOrder Hub collects customer messages from the social and messaging
platforms a Malaysian SME already uses, normalises them into one inbox, and
passes them through the existing extraction → order → human approval pipeline.

The feature is visible in the app under **Channel Hub**.

> **Demo status.** The five social connectors (WhatsApp, Messenger, Instagram,
> Telegram, TikTok) are deterministic sample adapters. They do **not** call
> live platform APIs. The **Email Inbox** connector is different: it is a real
> read-only IMAP connector. Configure a dedicated test mailbox in **Channel Hub
> → Email settings**, or set the `EMAIL_IMAP_*` server secrets. For the SDC
> Hackathon, use synthetic emails only and never connect a real customer inbox.
> The webhook endpoint is real, but the social platform OAuth handshakes,
> signature verification and token storage described below still have to be
> implemented before a production launch.

---

## 1. What is implemented

| Area | Status |
|---|---|
| Six channel records with connection state | Implemented (`backend/app/channels.py`) |
| Channel Hub screen with connect / reconnect / disconnect / sync | Implemented |
| Sync one channel and sync all connected channels | Implemented; deterministic samples for social, real IMAP for email when configured |
| Email IMAP connector | Implemented (`backend/app/email_connector.py`) |
| Email background poller | Implemented when `autoSync` is on and `EMAIL_POLL_SECONDS > 0` |
| Email credentials | Session memory or environment secrets; never written to `db.json` |
| Normalised webhook ingestion endpoint | Implemented |
| Optional `X-Webhook-Token` shared secret | Implemented |
| Duplicate prevention by `source` + `externalId` (email uses `Message-ID`) | Implemented |
| Activity log entries for connects, disconnects and imports | Implemented |
| Imported messages enter the normal AI/rules extraction flow | Implemented |
| Real OAuth, platform token refresh, signed social payloads | **Not implemented** |
| Background polling for social channels | **Not implemented**; only email polls |
| Media, voice-note, image and email attachment download | **Not implemented** |

The UI labels social connectors as demo samples and the email connector as
either **IMAP live** or **Demo sample**. Do not describe the social adapters as
live integrations during judging.

---

## 2. Channels

| Channel ID | Platform | Connection mode shown in UI | Demo state |
|---|---|---|---|
| `CH-WHATSAPP` | WhatsApp Business | WhatsApp Cloud API | Connected (sample) |
| `CH-FACEBOOK` | Facebook Messenger | Messenger Platform | Needs attention (sample) |
| `CH-INSTAGRAM` | Instagram DM | Instagram Graph API | Connected (sample) |
| `CH-TELEGRAM` | Telegram Business | Telegram Bot API | Connected (sample) |
| `CH-EMAIL` | Email inbox | IMAP / order mailbox | Connected; real IMAP when configured, otherwise sample |
| `CH-TIKTOK` | TikTok Business | TikTok Business Messaging | Not connected (sample) |

`CH-FACEBOOK` starts in `needs_attention` to demonstrate the reconnect state.
The backend's stored `lastError` is original English system text; the UI shows a
localised explanation and keeps the original in the element's tooltip/audit
meaning.

---

## 3. Data flow

```
WhatsApp / Messenger / Instagram / Telegram / TikTok      Email inbox
                         │                                   │
             (demo) local sample bank              IMAP read-only fetch
             (production) social API/webhook       or /api/email/sync
                         │                                   │
                         └──────────────┬────────────────────┘
                                        ▼
                     _append_channel_message() / _sync_email_payloads()
                           normalise + deduplicate (source + externalId)
                                        │
                                        ▼
                           messages[] in the JSON store
                                        │
                                        ▼
              existing extract → create order → stock/margin/risk checks
                                        │
                                        ▼
                            owner approval + activity log
```

The email path is:

```
Channel Hub → Email settings
  → POST /api/email/connect (test + keep session credentials)
  → POST /api/email/sync (fetch now)
  → background poller every EMAIL_POLL_SECONDS when autoSync is on
  → email_connector.fetch_messages()
  → message_to_payload() with Message-ID as externalId
  → _sync_email_payloads() → inbox
```

A collected message has the same shape as a manually added message:

```json
{
  "id": "MSG-0042",
  "source": "instagram",
  "sender": "@thestudio.kl",
  "contact": "Instagram DM",
  "channelId": "CH-INSTAGRAM",
  "channelAccount": "@kopikita.my",
  "externalId": "ch-instagram-1",
  "originalText": "Can I reserve 3 kaya toast sets ...?",
  "timestamp": "2026-10-23T04:12:00+00:00",
  "status": "not_analyzed",
  "parsedData": null
}
```

`source` is one of `whatsapp`, `facebook`, `instagram`, `telegram`, `email`,
`tiktok`, or `manual`.

---

## 4. API contract

### List channels

```http
GET /api/channels
```

Returns public channel state only. Access tokens are never included.

```json
[
  {
    "id": "CH-INSTAGRAM",
    "source": "instagram",
    "name": "Instagram DM",
    "account": "@kopikita.my",
    "connectionMode": "Instagram Graph API",
    "status": "connected",
    "autoSync": true,
    "lastSyncAt": "2026-10-23T04:05:00+00:00",
    "importedCount": 1,
    "lastError": null,
    "webhookPath": "/api/channels/CH-INSTAGRAM/webhook"
  }
]
```

### Connection actions

```http
POST   /api/channels/{channel_id}/connect
POST   /api/channels/{channel_id}/disconnect
PATCH  /api/channels/{channel_id}          {"autoSync": true}
```

`connect` moves a channel to `connected` and clears `lastError`. `disconnect`
moves it to `not_connected` and disables auto-sync. Enabling auto-sync on a
disconnected channel returns `409`.

### Channel sync

```http
POST /api/channels/{channel_id}/sync
POST /api/channels/sync-all
```

For the five social channels, each call inserts one deterministic sample
message. The sample bank advances on every call, so repeated clicks do not
create identical rows. For `CH-EMAIL`, the call fetches new mail when an IMAP
mailbox is configured; otherwise it falls back to the email sample.

`sync` and `sync-all` require the demo owner headers described in the README
(`X-Demo-Role: owner`, `X-Demo-Actor: Demo Owner`). `sync-all` fetches email
once, then syncs every connected channel. It returns:

```json
{
  "channels": [],
  "messages": [],
  "syncedChannels": 4
}
```

Syncing a channel that is not connected returns `409`.

### Webhook ingestion

```http
POST /api/channels/{channel_id}/webhook
Content-Type: application/json
X-Webhook-Token: <SMARTORDERHUB_CHANNEL_WEBHOOK_TOKEN>
```

Request body:

```json
{
  "sender": "Aina Catering",
  "contact": "+60 12-441 8820",
  "originalText": "30 nasi lemak and 30 kopi sachets for Friday 9am.",
  "externalId": "wamid.HBgM...",
  "timestamp": "2026-10-23T04:12:00+00:00"
}
```

`externalId` is optional, but strongly recommended. If the store already has a
message with the same `source` and `externalId`, the call returns the existing
message instead of creating a duplicate.

Responses:

| Status | Meaning |
|---|---|
| `201` | Message stored (or an existing duplicate returned) |
| `401` | `X-Webhook-Token` missing or wrong when a token is configured |
| `404` | Unknown channel ID |
| `409` | Channel is not connected |
| `422` | Payload validation failed |

Example:

```bash
curl -X POST http://localhost:8000/api/channels/CH-WHATSAPP/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: $SMARTORDERHUB_CHANNEL_WEBHOOK_TOKEN" \
  -d '{"sender":"Aina Catering","originalText":"30 nasi lemak for Friday 9am","externalId":"demo-001"}'
```

The endpoint accepts a **normalised** payload. It does not understand native
Meta, Telegram, email MIME or TikTok webhook envelopes. The email connector
handles MIME itself; the social adapters still need a production translator.

### Email connector

The email connector is separate from the normalised webhook because IMAP is a
pull protocol. It reads one mailbox and never sends, deletes or marks a message
as read.

```http
GET    /api/email/status
POST   /api/email/test
POST   /api/email/connect
POST   /api/email/sync
DELETE /api/email/config
```

`GET /api/email/status` returns password-free state:

```json
{
  "configured": true,
  "source": "session",
  "host": "imap.gmail.com",
  "port": 993,
  "username": "orders@example.com",
  "mailbox": "INBOX",
  "useSsl": true,
  "maxMessages": 20,
  "pollSeconds": 60,
  "passwordSet": true,
  "channel": { "id": "CH-EMAIL", "status": "connected" }
}
```

`POST /api/email/connect` accepts:

```json
{
  "host": "imap.gmail.com",
  "port": 993,
  "username": "orders@example.com",
  "password": "app-password",
  "mailbox": "INBOX",
  "useSsl": true
}
```

It tests the login first. On success it keeps the credentials in process memory
for the current session and marks `CH-EMAIL` connected. The password is never
returned to the browser or written to `db.json`. Set `EMAIL_IMAP_HOST`,
`EMAIL_IMAP_USER` and `EMAIL_IMAP_PASSWORD` in Replit Secrets for credentials
that survive a restart.

`POST /api/email/sync` fetches the newest `EMAIL_MAX_MESSAGES` emails, converts
them to normalised inbox payloads, and deduplicates by `Message-ID`. A
background poller runs every `EMAIL_POLL_SECONDS` when the email channel is
connected and `autoSync` is on. `0` disables the poller.

`DELETE /api/email/config` removes session credentials. It does not remove
server environment secrets.

Example:

`POST /api/email/test`, `/connect`, `/sync` and `DELETE /config` require the
demo owner headers:

```http
X-Demo-Role: owner
X-Demo-Actor: Demo Owner
```

```bash
curl -X POST http://localhost:8000/api/email/connect \
  -H "Content-Type: application/json" \
  -H "X-Demo-Role: owner" \
  -H "X-Demo-Actor: Demo Owner" \
  -d '{"host":"imap.gmail.com","port":993,"username":"orders@example.com","password":"app-password","mailbox":"INBOX","useSsl":true}'

curl -X POST http://localhost:8000/api/email/sync \
  -H "X-Demo-Role: owner" \
  -H "X-Demo-Actor: Demo Owner"
```

---

## 5. Production integration requirements

### WhatsApp Business Cloud API

- Create a Meta app with the WhatsApp product and a business phone number.
- Configure the callback URL to the backend adapter and subscribe to the
  `messages` field.
- Verify `hub.mode`, `hub.verify_token` and `hub.challenge` during setup.
- Verify `X-Hub-Signature-256` on every request using the app secret and the raw
  request body.
- Store the system user access token and phone-number ID server-side.
- Download media with the media ID when a customer sends an image or voice note.
- Respect the 24-hour customer-service window for free-form replies.

Docs: <https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks>

### Facebook Messenger

- Connect a Facebook Page to the app; request `pages_messaging` and the
  appropriate page permissions.
- Use a Page access token with a long-lived system-user token where possible.
- Verify the webhook challenge and `X-Hub-Signature-256`.
- Refresh or re-authorise expired Page tokens; map that failure to the
  `needs_attention` state already shown in the UI.

Docs: <https://developers.facebook.com/docs/messenger-platform/webhooks>

### Instagram DM

- Use an Instagram professional account linked to a Facebook Page.
- Request `instagram_basic`, `instagram_manage_messages` and the Page permission
  required by the current API version.
- Subscribe to the `messages` webhook field.
- Verify the Meta signature and handle message echoes so the business's own
  replies are not re-imported as customer orders.

Docs: <https://developers.facebook.com/docs/instagram-platform/webhooks>

### Telegram Business

- Create a bot with BotFather and store the bot token server-side.
- Register a webhook with `setWebhook`, including a `secret_token`.
- Verify the `X-Telegram-Bot-Api-Secret-Token` header before processing.
- If using long polling instead, persist the update offset to avoid duplicates.
- A Telegram Business connection may require the account owner to grant the bot
  access in Telegram settings.

Docs: <https://core.telegram.org/bots/api#setwebhook>

### Email

The repository now includes a working read-only IMAP connector in
`backend/app/email_connector.py`.

- Use SSL on port 993. Gmail requires an App Password; Microsoft 365 may require
  OAuth or an app password depending on tenant policy.
- The connector searches the selected folder, downloads the newest
  `EMAIL_MAX_MESSAGES`, parses MIME multipart bodies, strips quoted replies and
  signatures, and keeps attachment metadata out of the text.
- `Message-ID` is the idempotency key. Re-syncing the same mailbox does not
  create duplicate inbox rows.
- The connector never sends, deletes or marks messages as read
  (`select(..., readonly=True)`).
- For production, prefer OAuth 2.0 for Gmail/Microsoft 365 over app passwords,
  and use a dedicated order mailbox such as `orders@business.my`, not a
  personal inbox.
- Add UIDVALIDITY/UID persistence if you need true incremental sync; the demo
  re-reads the newest N messages and relies on `Message-ID` dedupe.
- Apply SPF/DKIM/DMARC checks at the mail gateway before accepting mail.

### TikTok Business Messaging

- Apply for TikTok API access and the Business Messaging permission for the
  account.
- Complete the OAuth authorisation flow and store refresh tokens securely.
- Subscribe to the messaging webhook and verify TikTok's signature headers.
- TikTok API access is approval-based; confirm current eligibility before
  promising this connector to a customer.

---

## 6. Security checklist

- [ ] Keep platform access tokens in a secret manager or environment variables;
      never in `db.json`, browser storage, logs or Git.
- [ ] Encrypt refresh tokens at rest and record rotation/expiry.
- [ ] Verify every platform signature against the **raw** request body.
- [ ] Keep `SMARTORDERHUB_CHANNEL_WEBHOOK_TOKEN` long and random; rotate it.
- [ ] Enforce HTTPS and restrict inbound webhook routes at the edge.
- [ ] Rate-limit webhook and sync endpoints.
- [ ] Use `externalId` idempotency plus a short replay window.
- [ ] Mask phone numbers and addresses in logs; follow Malaysia's PDPA
      retention and consent requirements.
- [ ] Do not import the business's own outgoing messages as customer orders.
- [ ] Add an allowlist for supported channel IDs and reject unknown senders or
      malformed payloads.
- [ ] Review platform terms for message storage and automated processing.
- [ ] Keep email app passwords only in server secrets or session memory; never
      in `db.json`, browser storage, logs or Git.
- [ ] Use a dedicated test mailbox with synthetic messages for the hackathon;
      do not connect a real customer inbox.

The demo's shared token is **not** a substitute for platform signature
verification. It only prevents unauthenticated calls to the demo webhook.

---

## 7. Adding a real adapter

The existing code already provides the seam:

1. `CHANNEL_DEFINITIONS` in `backend/app/channels.py` defines the channel and
   its public metadata.
2. `_append_channel_message()` in `backend/app/main.py` normalises, deduplicates
   and stores a message, then writes the `message_received` activity entry.
3. A production adapter should:
   - receive the platform payload on a dedicated route,
   - verify the platform signature,
   - map the payload to `{sender, contact, originalText, externalId, timestamp}`,
   - call the same normalisation/storage helper (or post to the internal
     webhook endpoint),
   - store only safe connection metadata in the public channel record.
4. The email adapter already follows this pattern in
   `backend/app/email_connector.py` and `_sync_email_payloads()`.
5. For the remaining social channels, replace `next_sample()` with a real fetch
   call for **Sync now**, or keep it behind an explicit demo flag so production
   never inserts synthetic messages.
6. Add platform webhook subscriptions or a scheduler for social auto-sync. The
   email channel already has a background poller; the social `autoSync` field
   is only a stored preference.

Suggested module layout for production:

```
backend/app/channels/
├── base.py            # normalised message + adapter protocol
├── whatsapp.py
├── facebook.py
├── instagram.py
├── telegram.py
├── email.py           # already implemented as app/email_connector.py
└── tiktok.py
```

Keep the rest of the order pipeline unchanged: every adapter feeds the same
inbox, extraction, rules, approval and audit path.

---

## 8. Tests

The channel and email flows are covered in `backend/tests/test_flow.py`:

```bash
cd smartorder-hub/backend
pytest -q
```

The suite covers:

- all six channels exist and Facebook starts in `needs_attention`;
- reconnecting Facebook clears the error;
- syncing adds one normalised message;
- `sync-all` reports the connected channel count;
- webhook ingestion creates a message;
- a duplicate `externalId` does not create a second message;
- a webhook to a disconnected channel returns `409`;
- email MIME parsing, quoted-reply stripping and Message-ID generation;
- email status never exposes the password;
- email connect → sync → deduplicate → disconnect;
- the IMAP fetch path selects the mailbox read-only and parses messages;
- the email poller imports new mail only when auto-sync is on and deduplicates
  the next poll.

Expected suite result: **34 passed**.

---

## 9. Honest limitations

- The **five social connectors** are demo adapters, not live platform integrations.
- The **email connector is real**, but it supports one mailbox at a time and
  reads the newest `EMAIL_MAX_MESSAGES` messages; it does not persist IMAP
  UIDVALIDITY/UID state.
- No social OAuth flow, token refresh, signature verification or media download
  is implemented.
- Email attachments are not downloaded or parsed; only the text body is used.
- Session email credentials are lost when the server restarts. Use
  `EMAIL_IMAP_*` server secrets for persistent auto-sync.
- The webhook accepts normalised JSON, not native platform envelopes.
- The JSON store is single-process and is not a production message queue.
- The UI is trilingual, but incoming customer messages and backend-generated
  analysis/audit text remain in the language in which they were created. This
  preserves the audit record; it is not a live translation feature.
