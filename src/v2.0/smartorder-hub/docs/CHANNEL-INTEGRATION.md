# Channel collection and integration guide

SmartOrder Hub collects customer messages from the social and messaging
platforms a Malaysian SME already uses, normalises them into one inbox, and
passes them through the existing extraction → order → human approval pipeline.

The feature is visible in the app under **Channel Hub**.

> **Demo status.** The six connectors in this repository are deterministic
> sample adapters. They do **not** call WhatsApp, Meta, Telegram, an email
> server or TikTok. Clicking **Sync now** or **Sync all channels** inserts a
> synthetic message from the local sample bank. This is intentional for the SDC
> Hackathon demo: it works offline, produces repeatable screenshots and never
> touches a customer's real account. The webhook endpoint is real, but the
> platform OAuth handshakes, signature verification and token storage described
> below still have to be implemented before a production launch.

---

## 1. What is implemented

| Area | Status |
|---|---|
| Six channel records with connection state | Implemented (`backend/app/channels.py`) |
| Channel Hub screen with connect / reconnect / disconnect / sync | Implemented |
| Sync one channel and sync all connected channels | Implemented with deterministic samples |
| Normalised webhook ingestion endpoint | Implemented |
| Optional `X-Webhook-Token` shared secret | Implemented |
| Duplicate prevention by `source` + `externalId` | Implemented |
| Activity log entries for connects, disconnects and imports | Implemented |
| Imported messages enter the normal AI/rules extraction flow | Implemented |
| Real OAuth, platform token refresh, signed platform payloads | **Not implemented** |
| Background polling / scheduled auto-sync | **Not implemented** (`autoSync` is stored as a preference) |
| Media, voice-note, image and attachment download | **Not implemented** |

The UI states this limitation in the Channel Hub demo notice. Do not describe
the demo adapters as live integrations during judging.

---

## 2. Channels

| Channel ID | Platform | Connection mode shown in UI | Demo state |
|---|---|---|---|
| `CH-WHATSAPP` | WhatsApp Business | WhatsApp Cloud API | Connected |
| `CH-FACEBOOK` | Facebook Messenger | Messenger Platform | Needs attention |
| `CH-INSTAGRAM` | Instagram DM | Instagram Graph API | Connected |
| `CH-TELEGRAM` | Telegram Business | Telegram Bot API | Connected |
| `CH-EMAIL` | Email inbox | IMAP / order mailbox | Connected |
| `CH-TIKTOK` | TikTok Business | TikTok Business Messaging | Not connected |

`CH-FACEBOOK` starts in `needs_attention` to demonstrate the reconnect state.
The backend's stored `lastError` is original English system text; the UI shows a
localised explanation and keeps the original in the element's tooltip/audit
meaning.

---

## 3. Data flow

```
WhatsApp / Messenger / Instagram / Telegram / Email / TikTok
                         │
             (demo) local sample bank
             (production) official API or webhook
                         │
                         ▼
        POST /api/channels/{channel_id}/webhook
        or POST /api/channels/{channel_id}/sync
                         │
                         ▼
   _append_channel_message() — normalise + deduplicate
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

### Demo sync

```http
POST /api/channels/{channel_id}/sync
POST /api/channels/sync-all
```

Each call inserts one deterministic sample message per connected channel. The
sample bank advances on every call, so repeated clicks do not create identical
rows. `sync-all` returns:

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

The endpoint accepts a **normalised** payload. It does not understand the native
Meta, Telegram, email MIME or TikTok webhook envelopes. A production adapter
must verify and translate those envelopes first.

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

- Prefer OAuth 2.0 for Gmail or Microsoft 365 over storing a mailbox password.
- Poll with IMAP UIDVALIDITY/UID tracking, or use the provider's push
  notification API.
- Parse MIME multipart bodies, strip quoted replies and signatures, and store
  attachment metadata without executing attachments.
- Use a dedicated order mailbox such as `orders@business.my`, not a personal
  inbox.
- Apply SPF/DKIM/DMARC checks and rate limits before accepting mail.

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
4. Replace `next_sample()` with a real fetch call for **Sync now**, or keep it
   behind an explicit demo flag so production never inserts synthetic messages.
5. Add a scheduler or platform webhook subscription for true auto-sync. The
   existing `autoSync` field is only a stored preference; nothing polls in the
   background today.

Suggested module layout for production:

```
backend/app/channels/
├── base.py            # normalised message + adapter protocol
├── whatsapp.py
├── facebook.py
├── instagram.py
├── telegram.py
├── email.py
└── tiktok.py
```

Keep the rest of the order pipeline unchanged: every adapter feeds the same
inbox, extraction, rules, approval and audit path.

---

## 8. Tests

The channel flow is covered in `backend/tests/test_flow.py`:

```bash
cd smartorder-hub/backend
pytest -q
```

The channel test covers:

- all six channels exist and Facebook starts in `needs_attention`;
- reconnecting Facebook clears the error;
- syncing adds one normalised message;
- `sync-all` reports the connected channel count;
- webhook ingestion creates a message;
- a duplicate `externalId` does not create a second message;
- a webhook to a disconnected channel returns `409`.

Expected suite result: **16 passed**.

---

## 9. Honest limitations

- The connectors are **demo adapters**, not live platform integrations.
- No OAuth flow, token refresh, signature verification or media download is
  implemented.
- `autoSync` does not start a scheduler.
- The webhook accepts normalised JSON, not native platform envelopes.
- The JSON store is single-process and is not a production message queue.
- The UI is trilingual, but incoming customer messages and backend-generated
  analysis/audit text remain in the language in which they were created. This
  preserves the audit record; it is not a live translation feature.
