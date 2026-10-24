"""SmartOrder Hub API.

The demo journey:
  message -> extraction -> order draft -> rule analysis -> human decision
  -> order record + purchase drafts + activity log + CSV export.
"""

from __future__ import annotations

import csv
import hmac
import io
import logging
import math
import threading
import time
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import (
    ai_client,
    channels as channel_service,
    config,
    email_connector,
    extraction,
    risk_insights,
    rules,
)
from .excel_export import generate_order_excel, safe_cell
from .industries import (
    INDUSTRIES,
    get_industry,
    industry_summary,
    list_industries,
)
from .models import (
    ChannelSettings,
    ChannelWebhookMessage,
    DecisionRequest,
    EmailConfigRequest,
    ExtractRequest,
    IndustryChange,
    MessageCreate,
    MessagePatch,
    OwnerLoginRequest,
)
from .orbyte_adapter import MockOrbyteAdapter
from .store import Store, find_by_id, next_id, product_by_sku

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smartorder-hub")

@asynccontextmanager
async def lifespan(_app: FastAPI):
    _start_email_poller()
    try:
        yield
    finally:
        _stop_email_poller()


app = FastAPI(
    title="SmartOrder Hub API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if config.ENABLE_API_DOCS else None,
    redoc_url=None,
    openapi_url="/openapi.json" if config.ENABLE_API_DOCS else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "X-Demo-Role",
        "X-Demo-Actor",
        "X-Owner-Password",
        "X-Webhook-Token",
    ],
)

store = Store(config.DATA_DIR)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError):
    """Do not echo raw invalid input (including non-finite JSON) to clients."""

    safe_errors = []
    for error in exc.errors():
        safe_errors.append(
            {
                "loc": list(error.get("loc", [])),
                "msg": str(error.get("msg", "Invalid value")),
                "type": str(error.get("type", "value_error")),
            }
        )
    return JSONResponse(status_code=422, content={"detail": safe_errors})


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    """Reject oversized API bodies and add low-risk hardening headers."""

    if request.url.path.startswith("/api/") and request.method in (
        "POST",
        "PUT",
        "PATCH",
    ):
        raw_length = request.headers.get("content-length")
        if raw_length:
            try:
                length = int(raw_length)
            except ValueError:
                return JSONResponse(
                    status_code=400, content={"detail": "Invalid Content-Length."}
                )
            if length > config.MAX_REQUEST_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request body is too large."},
                )

    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    if request.headers.get("x-forwarded-proto", "").lower() == "https":
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000"
        )
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
    )
    # Allow the Replit preview/editor to embed the app, but not arbitrary sites.
    response.headers.setdefault(
        "Content-Security-Policy",
        "frame-ancestors 'self' https://replit.com https://*.replit.com "
        "https://*.replit.dev https://*.replit.app",
    )
    return response


def _demo_identity(
    x_demo_role: Optional[str] = Header(default=None, alias="X-Demo-Role"),
    x_demo_actor: Optional[str] = Header(default=None, alias="X-Demo-Actor"),
    x_owner_password: Optional[str] = Header(
        default=None, alias="X-Owner-Password"
    ),
) -> dict[str, str]:
    """Resolve the simulated demo identity.

    Domain 2 explicitly allows a simulated login/RBAC layer. This is a
    server-side guard for the demo UI, not a replacement for Orbyte SSO. It
    fails closed to ``staff`` when the header is absent or unrecognised.
    """

    role = "owner" if (x_demo_role or "").strip().lower() == "owner" else "staff"
    if role == "owner" and config.OWNER_PASSWORD:
        if not hmac.compare_digest(
            x_owner_password or "", config.OWNER_PASSWORD
        ):
            role = "staff"
    default_actor = "Demo Owner" if role == "owner" else "Demo Staff"
    actor = (x_demo_actor or default_actor).replace("\r", " ").replace("\n", " ")
    actor = " ".join(actor.split())[:80] or default_actor
    return {"role": role, "actor": actor}


def _require_owner(
    identity: dict[str, str] = Depends(_demo_identity),
) -> dict[str, str]:
    if identity["role"] != "owner":
        raise HTTPException(
            status_code=403,
            detail="Owner role required for this action.",
        )
    return identity


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log(
    data: dict,
    actor: str,
    role: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: str,
) -> dict:
    event = {
        "id": next_id("EVT", data["activity"]),
        "ts": now_iso(),
        "actor": actor,
        "role": role,
        "action": action,
        "entityType": entity_type,
        "entityId": entity_id,
        "details": details,
    }
    data["activity"].append(event)
    return event


def _message_or_404(data: dict, message_id: str) -> dict:
    message = find_by_id(data["messages"], message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    return message


def _order_or_404(data: dict, order_id: str) -> dict:
    order = find_by_id(data["orders"], order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _channel_or_404(data: dict, channel_id: str) -> dict:
    try:
        return channel_service.get_channel(data, channel_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Channel not found") from exc


def _append_channel_message(data: dict, channel: dict, payload: dict) -> dict:
    """Normalise a platform payload into the shared inbox message shape."""

    external_id = payload.get("externalId")
    if external_id:
        existing = next(
            (
                message
                for message in data["messages"]
                if message.get("externalId") == external_id
                and message.get("source") == channel["source"]
            ),
            None,
        )
        if existing:
            return existing

    sender = " ".join(str(payload.get("sender") or "Unknown").split())
    contact = payload.get("contact")
    if contact is not None:
        contact = " ".join(str(contact).split())[:320] or None

    message = {
        "id": next_id("MSG", data["messages"]),
        "source": channel["source"],
        "sender": sender[:200] or "Unknown",
        "contact": contact,
        "channelId": channel["id"],
        "channelAccount": channel["account"],
        "externalId": external_id,
        "timestamp": payload.get("timestamp") or now_iso(),
        "originalText": str(payload.get("originalText") or "").strip(),
        "status": "not_analyzed",
        "parsedData": None,
        "reviewNotes": None,
        "errorMessage": None,
        "orderId": None,
    }
    data["messages"].append(message)
    _log(
        data,
        "Channel collector",
        "system",
        "message_received",
        "message",
        message["id"],
        f"{channel['name']} message from {message['sender']}",
    )
    return message


def _sync_channel_message(data: dict, channel: dict) -> Optional[dict]:
    sample = channel_service.next_sample(channel)
    channel["samplesServed"] = int(channel.get("samplesServed") or 0) + 1
    before = {message["id"] for message in data["messages"]}
    message = _append_channel_message(data, channel, sample)
    created = message["id"] not in before
    channel_service.mark_synced(channel, count=1 if created else 0)
    if created:
        _log(
            data,
            "Channel collector",
            "system",
            "channel_sync",
            "channel",
            channel["id"],
            f"Imported one message from {channel['name']}",
        )
    return message if created else None


def _sync_email_payloads(
    data: dict, channel: dict, payloads: list[dict]
) -> list[dict]:
    """Insert fetched emails into the inbox, skipping duplicate Message-IDs."""

    before = {message["id"] for message in data["messages"]}
    messages = [
        _append_channel_message(data, channel, payload) for payload in payloads
    ]
    created = [message for message in messages if message["id"] not in before]
    channel_service.mark_synced(channel, count=len(created), sample=False)
    if created:
        _log(
            data,
            "Email connector",
            "system",
            "email_sync",
            "channel",
            channel["id"],
            f"Imported {len(created)} email(s) from {channel['name']}",
        )
    return created


def _record_email_error(exc: Exception) -> None:
    detail = str(exc)[:240] or "Email sync failed."

    def mutate(data: dict) -> None:
        channel = _channel_or_404(data, "CH-EMAIL")
        channel["lastError"] = detail
        if isinstance(exc, email_connector.EmailAuthError):
            channel["status"] = "needs_attention"
            channel["autoSync"] = False
        _log(
            data,
            "Email connector",
            "system",
            "email_sync_failed",
            "channel",
            channel["id"],
            detail,
        )

    store.update(mutate)


def _fetch_email_payloads() -> list[dict]:
    try:
        return email_connector.fetch_messages()
    except email_connector.EmailConnectorError as exc:
        _record_email_error(exc)
        status_code = (
            401
            if isinstance(exc, email_connector.EmailAuthError)
            else 502
        )
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


_email_poll_lock = threading.Lock()
_email_poll_stop = threading.Event()


def _poll_email_once() -> int:
    """Background poll: fetch new mail only when email auto-sync is enabled."""

    if not email_connector.is_configured():
        return 0

    data = store.read()
    channel_service.ensure_channels(data)
    channel = next(
        (item for item in data.get("channels", []) if item["id"] == "CH-EMAIL"),
        None,
    )
    if (
        not channel
        or channel.get("status") != "connected"
        or not channel.get("autoSync")
    ):
        return 0

    with _email_poll_lock:
        try:
            payloads = email_connector.fetch_messages()
        except email_connector.EmailConnectorError as exc:
            _record_email_error(exc)
            return 0

        def mutate(current: dict) -> int:
            current_channel = _channel_or_404(current, "CH-EMAIL")
            if current_channel.get("status") != "connected":
                return 0
            messages = _sync_email_payloads(
                current, current_channel, payloads
            )
            current_channel["lastError"] = None
            return len(messages)

        return store.update(mutate)


def _start_email_poller() -> None:
    if config.EMAIL_POLL_SECONDS <= 0:
        return
    _email_poll_stop.clear()

    def loop() -> None:
        if _email_poll_stop.wait(5):
            return
        while not _email_poll_stop.is_set():
            try:
                _poll_email_once()
            except Exception:  # noqa: BLE001 - keep the poller alive
                logger.exception("Email poll failed")
            if _email_poll_stop.wait(config.EMAIL_POLL_SECONDS):
                return

    threading.Thread(
        target=loop, name="smartorderhub-email-poller", daemon=True
    ).start()


def _stop_email_poller() -> None:
    _email_poll_stop.set()


def _intake_summary(data: dict) -> dict:
    by_type: dict[str, int] = {}
    unprocessed = 0

    for message in data["messages"]:
        parsed = message.get("parsedData")
        if not isinstance(parsed, dict) or not parsed:
            unprocessed += 1
            continue
        message_type = str(parsed.get("messageType", "uncertain"))[:40]
        by_type[message_type] = by_type.get(message_type, 0) + 1

    orders = data["orders"]
    return {
        "industry": data["meta"].get("industry", "fnb"),
        "totalMessages": len(data["messages"]),
        "processedMessages": len(data["messages"]) - unprocessed,
        "unprocessed": unprocessed,
        "byType": by_type,
        "orders": len(orders),
        "awaitingConfirmation": sum(
            1 for order in orders if order["status"] == "analyzed"
        ),
        "approved": sum(1 for order in orders if order["status"] == "approved"),
        "needsInfo": sum(
            1 for order in orders if order["status"] == "info_requested"
        ),
        "rejected": sum(1 for order in orders if order["status"] == "rejected"),
    }


def _workspace(data: dict) -> dict:
    industry = get_industry(data["meta"].get("industry"))
    return {
        "businessName": data["meta"].get("businessName")
        or industry["businessName"],
        "industry": industry_summary(industry),
        "industries": [industry_summary(item) for item in list_industries()],
        "ai": ai_client.status(),
        "ownerPasswordRequired": bool(config.OWNER_PASSWORD),
        "rules": {
            "minMargin": config.MIN_MARGIN,
            "warnMargin": config.WARN_MARGIN,
            "highValueThreshold": config.HIGH_VALUE_THRESHOLD,
            "leadTimeBufferDays": config.LEAD_TIME_BUFFER_DAYS,
            "minConfidence": config.MIN_CONFIDENCE,
        },
        "stats": _intake_summary(data),
    }


@app.get("/api/health")
def health() -> dict:
    data = store.read()
    industry = get_industry(data["meta"].get("industry"))
    return {
        "status": "ok",
        "service": "smartorder-hub",
        "aiMode": (
            ai_client.status()["provider"]
            if ai_client.configured()
            else "rules-only"
        ),
        "business": data["meta"].get("businessName")
        or industry["businessName"],
    }


@app.get("/api/catalog")
def catalog() -> dict:
    data = store.read()
    payload = MockOrbyteAdapter(data).get_catalog()
    payload["industry"] = industry_summary(
        get_industry(data["meta"].get("industry"))
    )
    return payload


@app.get("/api/industries")
def industries() -> dict:
    return {"industries": [industry_summary(item) for item in list_industries()]}


@app.get("/api/workspace")
def workspace() -> dict:
    return _workspace(store.read())


@app.post("/api/session/owner")
def owner_login(body: OwnerLoginRequest) -> dict:
    """Validate the optional shared demo owner password before switching."""

    if not config.OWNER_PASSWORD:
        return {"ok": True, "required": False}
    if not hmac.compare_digest(
        body.password.get_secret_value(), config.OWNER_PASSWORD
    ):
        raise HTTPException(status_code=401, detail="Owner password is incorrect.")
    return {"ok": True, "required": True}


@app.post("/api/industry")
def switch_industry(
    body: IndustryChange,
    _owner: dict[str, str] = Depends(_require_owner),
) -> dict:
    if body.industry not in INDUSTRIES:
        raise HTTPException(status_code=400, detail="Unknown industry")
    email_connector.clear_session_config()
    data = store.reset(body.industry)
    _clear_risk_cache()
    return {"status": "switched", "workspace": _workspace(data)}


@app.get("/api/ai/status")
def ai_status() -> dict:
    return ai_client.status()


@app.post("/api/ai/test")
def ai_test(
    _owner: dict[str, str] = Depends(_require_owner),
) -> dict:
    """Make one tiny provider call so Settings can verify the connection."""

    try:
        return ai_client.test_connection()
    except ai_client.AIClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - report provider failures
        logger.exception("AI connection test failed")
        raise HTTPException(
            status_code=502,
            detail="AI connection test failed. Check the server logs.",
        ) from exc


_risk_insight_cache: dict[tuple, tuple[float, dict]] = {}
_risk_insight_lock = threading.Lock()
_RISK_INSIGHT_TTL_SECONDS = 30.0


def _clear_risk_cache() -> None:
    with _risk_insight_lock:
        _risk_insight_cache.clear()


@app.get("/api/risk/insights")
def risk_insight(language: str = "en") -> dict:
    """Aggregate the two largest risk types and produce a short brief."""

    if language not in ("en", "zh", "ms"):
        language = "en"
    data = store.read()
    orders = data["orders"]
    industry = data["meta"].get("industry", "fnb")
    signature = (
        language,
        industry,
        len(orders),
        max((order.get("updatedAt") or "") for order in orders) if orders else "",
        ai_client.configured(),
        config.AI_PROVIDER,
        config.AI_MODEL,
    )
    now = time.monotonic()
    with _risk_insight_lock:
        cached = _risk_insight_cache.get(signature)
        if cached and now - cached[0] < _RISK_INSIGHT_TTL_SECONDS:
            return cached[1]

    result = risk_insights.generate_risk_insights(
        orders,
        language=language,
        industry=industry,
    )
    with _risk_insight_lock:
        _risk_insight_cache[signature] = (now, result)
        # Keep the cache tiny; the workspace is a single demo dataset.
        if len(_risk_insight_cache) > 12:
            oldest = min(_risk_insight_cache, key=lambda key: _risk_insight_cache[key][0])
            _risk_insight_cache.pop(oldest, None)
    return result


@app.get("/api/rules")
def rule_config() -> dict:
    return {
        "minMargin": config.MIN_MARGIN,
        "warnMargin": config.WARN_MARGIN,
        "highValueThreshold": config.HIGH_VALUE_THRESHOLD,
        "leadTimeBufferDays": config.LEAD_TIME_BUFFER_DAYS,
        "minConfidence": config.MIN_CONFIDENCE,
    }


@app.get("/api/channels")
def list_channels() -> list[dict]:
    """Return the platform connections and their safe, public state."""

    def mutate(data: dict) -> list[dict]:
        channel_service.initial_channel_timestamps(data)
        return [
            channel_service.channel_public_view(channel)
            for channel in channel_service.ensure_channels(data)
        ]

    return store.update(mutate)


@app.post("/api/channels/{channel_id}/connect")
def connect_channel(
    channel_id: str,
    identity: dict[str, str] = Depends(_require_owner),
) -> dict:
    def mutate(data: dict) -> dict:
        channel = _channel_or_404(data, channel_id)
        channel_service.mark_connected(channel)
        _log(
            data,
            identity["actor"],
            identity["role"],
            "channel_connected",
            "channel",
            channel_id,
            f"Connected {channel['name']} for read-only order collection",
        )
        return channel_service.channel_public_view(channel)

    return store.update(mutate)


@app.post("/api/channels/{channel_id}/disconnect")
def disconnect_channel(
    channel_id: str,
    identity: dict[str, str] = Depends(_require_owner),
) -> dict:
    def mutate(data: dict) -> dict:
        channel = _channel_or_404(data, channel_id)
        channel_service.mark_disconnected(channel)
        _log(
            data,
            identity["actor"],
            identity["role"],
            "channel_disconnected",
            "channel",
            channel_id,
            f"Disconnected {channel['name']}",
        )
        return channel_service.channel_public_view(channel)

    return store.update(mutate)


@app.patch("/api/channels/{channel_id}")
def update_channel(
    channel_id: str,
    body: ChannelSettings,
    identity: dict[str, str] = Depends(_require_owner),
) -> dict:
    def mutate(data: dict) -> dict:
        channel = _channel_or_404(data, channel_id)
        if body.autoSync is not None:
            if body.autoSync and channel["status"] != "connected":
                raise HTTPException(
                    status_code=409,
                    detail="Connect the channel before enabling auto-sync.",
                )
            channel["autoSync"] = body.autoSync
            _log(
                data,
                identity["actor"],
                identity["role"],
                "channel_updated",
                "channel",
                channel_id,
                f"Auto-sync {'enabled' if body.autoSync else 'disabled'} "
                f"for {channel['name']}",
            )
        return channel_service.channel_public_view(channel)

    return store.update(mutate)


@app.post("/api/channels/{channel_id}/sync")
def sync_channel(
    channel_id: str,
    _owner: dict[str, str] = Depends(_require_owner),
) -> dict:
    data = store.read()
    channel = _channel_or_404(data, channel_id)
    if channel["status"] != "connected":
        raise HTTPException(
            status_code=409,
            detail="Reconnect this channel before syncing.",
        )

    if channel["source"] == "email" and not email_connector.is_configured():
        raise HTTPException(
            status_code=409,
            detail="Connect an email mailbox before syncing this channel.",
        )

    if channel["source"] == "email" and email_connector.is_configured():
        payloads = _fetch_email_payloads()

        def mutate(current: dict) -> dict:
            current_channel = _channel_or_404(current, channel_id)
            if current_channel["status"] != "connected":
                raise HTTPException(
                    status_code=409,
                    detail="Reconnect this channel before syncing.",
                )
            messages = _sync_email_payloads(
                current, current_channel, payloads
            )
            current_channel["lastError"] = None
            return {
                "channel": channel_service.channel_public_view(
                    current_channel
                ),
                "messages": messages,
            }

        return store.update(mutate)

    def mutate(data: dict) -> dict:
        channel = _channel_or_404(data, channel_id)
        message = _sync_channel_message(data, channel)
        return {
            "channel": channel_service.channel_public_view(channel),
            "messages": [message] if message else [],
        }

    return store.update(mutate)


@app.post("/api/channels/sync-all")
def sync_all_channels(
    _owner: dict[str, str] = Depends(_require_owner),
) -> dict:
    data = store.read()
    channel_service.initial_channel_timestamps(data)
    channels = channel_service.ensure_channels(data)
    connected = [
        channel for channel in channels if channel["status"] == "connected"
    ]

    email_payloads: Optional[list[dict]] = None
    email_error: Optional[Exception] = None
    email_ready = any(
        channel["source"] == "email" for channel in connected
    ) and email_connector.is_configured()
    if email_ready:
        try:
            email_payloads = email_connector.fetch_messages()
        except email_connector.EmailConnectorError as exc:
            email_error = exc

    def mutate(current: dict) -> dict:
        current_channels = channel_service.ensure_channels(current)
        messages: list[dict] = []
        synced = 0

        for channel in current_channels:
            if channel["status"] != "connected":
                continue
            if channel["source"] == "email" and email_connector.is_configured():
                if email_error is not None:
                    channel["lastError"] = str(email_error)[:240]
                    if isinstance(
                        email_error, email_connector.EmailAuthError
                    ):
                        channel["status"] = "needs_attention"
                        channel["autoSync"] = False
                    _log(
                        current,
                        "Email connector",
                        "system",
                        "email_sync_failed",
                        "channel",
                        channel["id"],
                        str(email_error)[:240],
                    )
                    continue
                channel_messages = _sync_email_payloads(
                    current, channel, email_payloads or []
                )
                channel["lastError"] = None
            elif channel["source"] == "email":
                # Never fabricate an email from the demo sample bank.
                continue
            else:
                message = _sync_channel_message(current, channel)
                channel_messages = [message] if message else []
            messages.extend(channel_messages)
            synced += 1

        if messages:
            _log(
                current,
                "Channel collector",
                "system",
                "channel_sync_all",
                "workspace",
                current["meta"].get("industry", "fnb"),
                f"Imported {len(messages)} messages from {synced} channels",
            )
        return {
            "channels": [
                channel_service.channel_public_view(channel)
                for channel in current_channels
            ],
            "messages": messages,
            "syncedChannels": synced,
            "errors": [str(email_error)] if email_error else [],
        }

    return store.update(mutate)


@app.post("/api/channels/{channel_id}/webhook", status_code=201)
def channel_webhook(
    channel_id: str,
    body: ChannelWebhookMessage,
    x_webhook_token: Optional[str] = Header(default=None, alias="X-Webhook-Token"),
) -> dict:
    """Production-style ingest endpoint.

    Platform adapters should forward a signed/normalised payload here. The
    demo accepts the request directly; set SMARTORDERHUB_CHANNEL_WEBHOOK_TOKEN
    to require an X-Webhook-Token header.
    """

    if config.CHANNEL_WEBHOOK_TOKEN and not hmac.compare_digest(
        x_webhook_token or "", config.CHANNEL_WEBHOOK_TOKEN
    ):
        raise HTTPException(status_code=401, detail="Invalid webhook token")

    def mutate(data: dict) -> dict:
        channel = _channel_or_404(data, channel_id)
        if channel["status"] != "connected":
            raise HTTPException(
                status_code=409,
                detail="Channel is not connected.",
            )
        message = _append_channel_message(
            data,
            channel,
            body.model_dump(),
        )
        return {
            "channel": channel_service.channel_public_view(channel),
            "message": message,
        }

    return store.update(mutate)


@app.get("/api/email/status")
def email_status(
    identity: dict[str, str] = Depends(_demo_identity),
) -> dict:
    """Password-free status for the Channel Hub email panel."""

    def mutate(data: dict) -> dict:
        channel_service.ensure_channels(data)
        channel = _channel_or_404(data, "CH-EMAIL")
        status = email_connector.status()
        if identity["role"] != "owner":
            # Staff only needs to know whether a mailbox is configured.
            status.update(
                host=None,
                port=None,
                username=None,
                mailbox=None,
                useSsl=None,
            )
        return {
            **status,
            "channel": channel_service.channel_public_view(channel),
        }

    return store.update(mutate)


@app.post("/api/email/test")
def email_test(
    body: Optional[EmailConfigRequest] = None,
    _owner: dict[str, str] = Depends(_require_owner),
) -> dict:
    try:
        config_to_test = (
            email_connector.build_config(
                host=body.host,
                port=body.port,
                username=body.username,
                password=body.password.get_secret_value(),
                mailbox=body.mailbox,
                use_ssl=body.useSsl,
            )
            if body
            else None
        )
        return email_connector.test_connection(config_to_test)
    except email_connector.EmailConnectorError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/email/connect")
def email_connect(
    body: EmailConfigRequest,
    identity: dict[str, str] = Depends(_require_owner),
) -> dict:
    """Test and keep mailbox credentials in memory for this server session."""

    try:
        mailbox_config = email_connector.build_config(
            host=body.host,
            port=body.port,
            username=body.username,
            password=body.password.get_secret_value(),
            mailbox=body.mailbox,
            use_ssl=body.useSsl,
        )
        test_result = email_connector.test_connection(mailbox_config)
    except email_connector.EmailConnectorError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    email_connector.set_session_config(mailbox_config)

    def mutate(data: dict) -> dict:
        channel = _channel_or_404(data, "CH-EMAIL")
        channel_service.mark_connected(channel)
        channel["lastError"] = None
        _log(
            data,
            identity["actor"],
            identity["role"],
            "email_connected",
            "channel",
            channel["id"],
            f"Connected {mailbox_config.username} on {mailbox_config.host}",
        )
        return {
            "status": {
                **email_connector.status(),
                "channel": channel_service.channel_public_view(channel),
            },
            "test": test_result,
        }

    return store.update(mutate)


@app.delete("/api/email/config")
def email_disconnect(
    identity: dict[str, str] = Depends(_require_owner),
) -> dict:
    """Remove session credentials; server-secret configuration is untouched."""

    email_connector.clear_session_config()

    def mutate(data: dict) -> dict:
        channel = _channel_or_404(data, "CH-EMAIL")
        if email_connector.is_configured():
            channel_service.mark_connected(channel)
        else:
            channel_service.mark_disconnected(channel)
        channel["lastError"] = None
        _log(
            data,
            identity["actor"],
            identity["role"],
            "email_disconnected",
            "channel",
            channel["id"],
            "Removed the session email credentials",
        )
        return {
            **email_connector.status(),
            "channel": channel_service.channel_public_view(channel),
        }

    return store.update(mutate)


@app.post("/api/email/sync")
def email_sync(
    identity: dict[str, str] = Depends(_require_owner),
) -> dict:
    """Fetch new mail immediately and add it to the shared inbox."""

    if not email_connector.is_configured():
        raise HTTPException(
            status_code=409,
            detail="Email is not configured. Connect a mailbox first.",
        )

    def mutate(data: dict) -> None:
        channel = _channel_or_404(data, "CH-EMAIL")
        if channel["status"] != "connected":
            channel_service.mark_connected(channel)
        channel["autoSync"] = True

    store.update(mutate)
    return sync_channel("CH-EMAIL", _owner=identity)


@app.get("/api/messages")
def list_messages(
    limit: int = Query(default=500, ge=1, le=2000),
) -> list[dict]:
    data = store.read()
    return sorted(
        data["messages"], key=lambda item: item.get("timestamp", ""), reverse=True
    )[:limit]


@app.post("/api/messages", status_code=201)
def create_message(body: MessageCreate) -> dict:
    def mutate(data: dict) -> dict:
        sender = " ".join(body.sender.split())[:200] or "Unknown"
        contact = body.contact
        if contact is not None:
            contact = " ".join(contact.split())[:320] or None
        message = {
            "id": next_id("MSG", data["messages"]),
            "source": body.source,
            "sender": sender,
            "contact": contact,
            "channelAccount": body.channelAccount,
            "externalId": None,
            "timestamp": body.timestamp or now_iso(),
            "originalText": body.originalText.strip(),
            "status": "not_analyzed",
            "parsedData": None,
            "reviewNotes": None,
            "errorMessage": None,
            "orderId": None,
        }
        data["messages"].append(message)
        _log(
            data,
            "System",
            "system",
            "message_received",
            "message",
            message["id"],
            f"{body.source.title()} message from {message['sender']}",
        )
        return message

    return store.update(mutate)


@app.post("/api/messages/{message_id}/extract")
def extract_message(message_id: str, body: ExtractRequest) -> dict:
    # Do the potentially slow AI call outside the global store lock. The
    # mutator below re-checks that the message is still unprocessed.
    snapshot = store.read()
    message = _message_or_404(snapshot, message_id)
    if message.get("orderId"):
        raise HTTPException(
            status_code=409,
            detail="This message already has an order. Reject or reset it first.",
        )
    industry_id = snapshot["meta"].get("industry", "fnb")
    result = extraction.extract_message(
        text=message["originalText"],
        sender=message["sender"],
        contact=message.get("contact"),
        products=snapshot["products"],
        mode=body.mode,
        industry=get_industry(industry_id),
    )

    def mutate(data: dict) -> dict:
        current = _message_or_404(data, message_id)
        if current.get("orderId"):
            raise HTTPException(
                status_code=409,
                detail="This message already has an order. Reject or reset it first.",
            )
        if data["meta"].get("industry", "fnb") != industry_id:
            raise HTTPException(
                status_code=409,
                detail="The workspace changed during extraction. Please retry.",
            )
        if current.get("originalText") != message.get("originalText"):
            raise HTTPException(
                status_code=409,
                detail="The message changed during extraction. Please retry.",
            )
        current["parsedData"] = result["parsedData"]
        current["status"] = result["status"]
        parsed = result["parsedData"] or {}
        _log(
            data,
            "SmartOrder Hub",
            "system",
            "message_extracted",
            "message",
            message_id,
            f"{parsed.get('method', 'rules')} extraction, "
            f"{len(parsed.get('items', []))} item(s), "
            f"confidence {parsed.get('confidenceScore', 0)}%",
        )
        return current

    return store.update(mutate)


@app.patch("/api/messages/{message_id}")
def patch_message(
    message_id: str,
    body: MessagePatch,
    identity: dict[str, str] = Depends(_demo_identity),
) -> dict:
    if body.parsedData is not None and identity["role"] != "owner":
        raise HTTPException(
            status_code=403,
            detail="Only the Owner can overwrite extracted fields.",
        )

    def mutate(data: dict) -> dict:
        message = _message_or_404(data, message_id)
        if body.status is not None:
            message["status"] = body.status
        if body.reviewNotes is not None:
            message["reviewNotes"] = body.reviewNotes
        if body.parsedData is not None:
            message["parsedData"] = body.parsedData
        _log(
            data,
            identity["actor"],
            identity["role"],
            "message_reviewed",
            "message",
            message_id,
            (
                "Owner corrected the extracted fields."
                if body.parsedData is not None
                else "Recognition status or notes updated."
            ),
        )
        return message

    return store.update(mutate)


@app.delete("/api/messages/{message_id}", status_code=204)
def delete_message(
    message_id: str,
    identity: dict[str, str] = Depends(_require_owner),
) -> None:
    def mutate(data: dict) -> None:
        message = _message_or_404(data, message_id)
        if message.get("orderId"):
            raise HTTPException(
                status_code=409,
                detail="An order exists for this message. Reject the order instead.",
            )
        data["messages"] = [
            item for item in data["messages"] if item["id"] != message_id
        ]
        _log(
            data,
            identity["actor"],
            identity["role"],
            "message_deleted",
            "message",
            message_id,
            "Message removed from the inbox.",
        )

    store.update(mutate)
    return None


def _build_order(data: dict, message: dict) -> dict:
    """Create an order draft from a message's extracted fields."""

    parsed = message.get("parsedData") or {}
    if not isinstance(parsed, dict):
        parsed = {}
    raw_items = parsed.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        raise HTTPException(
            status_code=400,
            detail="Extract the message first; no line items were found.",
        )
    if len(raw_items) > 50:
        raise HTTPException(
            status_code=400,
            detail="An order may contain at most 50 line items.",
        )

    items = []
    for raw in raw_items:
        if not isinstance(raw, dict):
            raise HTTPException(
                status_code=400, detail="Each order item must be an object."
            )
        raw_sku = raw.get("sku") if isinstance(raw.get("sku"), str) else None
        raw_name = raw.get("name") if isinstance(raw.get("name"), str) else None
        product = product_by_sku(data["products"], raw_sku) or extraction.match_product(
            data["products"], raw_name
        )
        sku = product["sku"] if product else (raw_sku or "UNMATCHED")
        name = product["name"] if product else raw_name or "Unknown item"

        raw_quantity = raw.get("quantity")
        if isinstance(raw_quantity, float) and not raw_quantity.is_integer():
            raise HTTPException(
                status_code=400, detail="Item quantity must be a whole number."
            )
        try:
            quantity = int(raw_quantity or 0)
        except (TypeError, ValueError, OverflowError) as exc:
            raise HTTPException(
                status_code=400, detail="Item quantity must be an integer."
            ) from exc
        if quantity <= 0 or quantity > 100_000:
            raise HTTPException(
                status_code=400,
                detail="Item quantity must be between 1 and 100,000.",
            )

        price_value = raw.get("unitPrice")
        if price_value not in (None, ""):
            try:
                unit_price = float(price_value)
            except (TypeError, ValueError, OverflowError) as exc:
                raise HTTPException(
                    status_code=400, detail="Item unit price must be a number."
                ) from exc
            if not math.isfinite(unit_price) or unit_price < 0 or unit_price > 10_000_000:
                raise HTTPException(
                    status_code=400,
                    detail="Item unit price must be a finite non-negative number.",
                )
        else:
            try:
                unit_price = float(product["sellPrice"]) if product else 0.0
            except (TypeError, ValueError, OverflowError):
                unit_price = 0.0
            if not math.isfinite(unit_price) or unit_price < 0:
                unit_price = 0.0

        items.append(
            {
                "sku": sku,
                "name": name,
                "quantity": quantity,
                "unitPrice": round(unit_price, 2),
                "lineTotal": round(quantity * unit_price, 2),
            }
        )

    try:
        confidence = float(parsed.get("confidenceScore") or 0) / 100
    except (TypeError, ValueError, OverflowError):
        confidence = 0.0
    if not math.isfinite(confidence):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    raw_industry_fields = parsed.get("industryFields")
    industry_fields: dict[str, str] = {}
    if isinstance(raw_industry_fields, dict):
        for key, value in raw_industry_fields.items():
            if isinstance(key, str) and value not in (None, ""):
                industry_fields[key[:80]] = str(value)[:500]

    customer_name = str(
        parsed.get("customerName") or message.get("sender") or "Unknown"
    ).strip()[:200] or "Unknown"
    contact_value = parsed.get("contact") or message.get("contact")
    contact_value = str(contact_value).strip()[:320] if contact_value else None
    delivery_type = str(parsed.get("deliveryType") or "unspecified")[:40]
    delivery_address = str(parsed.get("deliveryAddress") or "")[:500]
    requested_date = parsed.get("requestedDeliveryDate")
    requested_date = str(requested_date)[:64] if requested_date else None
    extraction_method = str(parsed.get("method", "rules"))[:40]

    order = {
        "id": next_id("ORD", data["orders"]),
        "messageId": message["id"],
        "source": message.get("source", "manual"),
        "industry": data["meta"].get("industry", "fnb"),
        "extractionMethod": extraction_method,
        "industryFields": industry_fields,
        "customerName": customer_name,
        "contact": contact_value,
        "items": items,
        "deliveryType": delivery_type,
        "deliveryAddress": delivery_address,
        "requestedDeliveryDate": requested_date,
        "notes": str(parsed.get("customerNotes") or "")[:2000],
        "confidence": round(confidence, 2),
        "status": "draft",
        "analysis": None,
        "approval": None,
        "purchaseDrafts": [],
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
    }
    data["orders"].append(order)
    message["orderId"] = order["id"]
    message["status"] = "recognized_as_order"
    _log(
        data,
        "SmartOrder Hub",
        "system",
        "order_created",
        "order",
        order["id"],
        f"Draft order created from {message['id']} for {order['customerName']}.",
    )
    return order


def _should_create_order(result: dict) -> bool:
    """Only turn complete-enough orders into table rows.

    A message with no catalogue match or no quantity stays in the raw inbox for
    human review; it must not become a misleading row in the order table.
    """

    if result.get("status") not in ("recognized_as_order", "needs_human_review"):
        return False
    parsed = result.get("parsedData")
    if not isinstance(parsed, dict) or not parsed.get("items"):
        return False
    missing = parsed.get("missingFields") or []
    return "quantity" not in missing and "items" not in missing


@app.post("/api/messages/{message_id}/order", status_code=201)
def create_order(message_id: str) -> dict:
    def mutate(data: dict) -> dict:
        message = _message_or_404(data, message_id)
        if message.get("orderId"):
            existing = find_by_id(data["orders"], message["orderId"])
            if existing:
                return existing

        parsed = message.get("parsedData") or {}
        if not parsed.get("items"):
            raise HTTPException(
                status_code=400,
                detail="Extract the message first; no line items were found.",
            )

        return _build_order(data, message)

    return store.update(mutate)


@app.post("/api/intake/process")
def process_intake() -> dict:
    """Classify every unprocessed message and fill the order review table."""

    # Extraction may call an AI provider (up to 30 s per message). Run it on a
    # snapshot outside the global store lock, then apply the results atomically.
    snapshot = store.read()
    industry_id = snapshot["meta"].get("industry", "fnb")
    results: dict[str, dict] = {}
    snapshot_text: dict[str, str] = {}
    for message in snapshot["messages"]:
        if message.get("parsedData") or message.get("orderId"):
            continue
        snapshot_text[message["id"]] = message.get("originalText", "")
        results[message["id"]] = extraction.extract_message(
            text=message["originalText"],
            sender=message["sender"],
            contact=message.get("contact"),
            products=snapshot["products"],
            mode=config.INTAKE_MODE,
            industry=get_industry(industry_id),
        )

    def mutate(data: dict) -> dict:
        if data["meta"].get("industry", "fnb") != industry_id:
            raise HTTPException(
                status_code=409,
                detail="The workspace changed during intake. Please retry.",
            )
        processed = 0
        created = 0
        by_type: dict[str, int] = {}

        for message in data["messages"]:
            if message.get("parsedData") or message.get("orderId"):
                continue
            result = results.get(message["id"])
            if result is None:
                continue
            if message.get("originalText") != snapshot_text.get(message["id"]):
                continue

            message["parsedData"] = result["parsedData"]
            message["status"] = result["status"]
            parsed = result["parsedData"] or {}
            message_type = str(parsed.get("messageType", "uncertain"))[:40]
            by_type[message_type] = by_type.get(message_type, 0) + 1
            processed += 1

            _log(
                data,
                "SmartOrder Hub",
                "system",
                "message_extracted",
                "message",
                message["id"],
                f"{parsed.get('method', 'rules')} extraction, "
                f"{len(parsed.get('items', []))} item(s), "
                f"type {message_type}, "
                f"confidence {parsed.get('confidenceScore', 0)}%",
            )

            if _should_create_order(result):
                order = _build_order(data, message)
                analysis = rules.analyze_order(
                    order,
                    data["products"],
                    data["suppliers"],
                    industry=get_industry(data["meta"].get("industry")),
                    history=data["orders"],
                )
                order["analysis"] = analysis
                order["status"] = "analyzed"
                order["updatedAt"] = now_iso()
                _log(
                    data,
                    "SmartOrder Hub",
                    "system",
                    "order_analyzed",
                    "order",
                    order["id"],
                    f"Recommendation {analysis['recommendation']}; "
                    f"margin {analysis['margin']:.1%}.",
                )
                created += 1

        return {
            "processed": processed,
            "ordersCreated": created,
            "byType": by_type,
        }

    return store.update(mutate)


@app.get("/api/intake/summary")
def intake_summary() -> dict:
    return _intake_summary(store.read())


@app.get("/api/orders")
def list_orders(
    limit: int = Query(default=500, ge=1, le=2000),
) -> list[dict]:
    data = store.read()
    return sorted(
        data["orders"], key=lambda item: item.get("createdAt", ""), reverse=True
    )[:limit]


@app.get("/api/orders/export.csv")
def export_orders_csv() -> StreamingResponse:
    data = store.read()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "order_id",
            "status",
            "customer",
            "delivery_date",
            "items",
            "revenue_myr",
            "cost_myr",
            "profit_myr",
            "margin",
            "recommendation",
            "approved_by",
            "created_at",
        ]
    )
    for order in data["orders"]:
        analysis = order.get("analysis") or {}
        approval = order.get("approval") or {}
        items = "; ".join(
            f"{item['quantity']} x {item['name']}" for item in order.get("items", [])
        )
        writer.writerow(
            [
                safe_cell(order["id"]),
                safe_cell(order["status"]),
                safe_cell(order["customerName"]),
                safe_cell(order.get("requestedDeliveryDate") or ""),
                safe_cell(items),
                analysis.get("revenue", ""),
                analysis.get("cost", ""),
                analysis.get("profit", ""),
                f"{analysis.get('margin', 0):.2%}" if analysis else "",
                safe_cell(analysis.get("recommendation", "")),
                safe_cell(approval.get("actor", "")),
                safe_cell(order.get("createdAt", "")),
            ]
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=smartorder-hub_orders.csv"
        },
    )


@app.get("/api/orders/export.xlsx")
def export_orders_xlsx() -> StreamingResponse:
    data = store.read()
    content = generate_order_excel(data["orders"])
    return StreamingResponse(
        io.BytesIO(content),
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": 'attachment; filename="smartorder-hub_orders.xlsx"'
        },
    )


@app.get("/api/orders/{order_id}")
def get_order(order_id: str) -> dict:
    data = store.read()
    return _order_or_404(data, order_id)


@app.post("/api/orders/{order_id}/analyze")
def analyze_order(order_id: str) -> dict:
    def mutate(data: dict) -> dict:
        order = _order_or_404(data, order_id)
        if order["status"] in ("approved", "rejected"):
            raise HTTPException(
                status_code=409,
                detail="Finalised orders cannot be re-analysed.",
            )
        analysis = rules.analyze_order(
            order,
            data["products"],
            data["suppliers"],
            industry=get_industry(data["meta"].get("industry")),
            history=data["orders"],
        )
        order["analysis"] = analysis
        order["status"] = "analyzed"
        order["updatedAt"] = now_iso()
        _log(
            data,
            "SmartOrder Hub",
            "system",
            "order_analyzed",
            "order",
            order_id,
            f"Recommendation {analysis['recommendation']}; margin "
            f"{analysis['margin']:.1%}; "
            f"{sum(1 for s in analysis['stock'] if s['shortfall'] > 0)} item(s) short.",
        )
        return order

    return store.update(mutate)


@app.post("/api/orders/{order_id}/decision")
def decide_order(
    order_id: str,
    body: DecisionRequest,
    identity: dict[str, str] = Depends(_demo_identity),
) -> dict:
    if identity["role"] == "staff" and body.decision in ("approve", "reject"):
        raise HTTPException(
            status_code=403,
            detail="Staff may request information but cannot approve or reject.",
        )

    def mutate(data: dict) -> dict:
        order = _order_or_404(data, order_id)
        if order["status"] in ("approved", "rejected"):
            raise HTTPException(
                status_code=409, detail="This order already has a final decision."
            )
        analysis = order.get("analysis")
        if not analysis:
            raise HTTPException(
                status_code=400, detail="Analyse the order before deciding."
            )

        recommendation = analysis["recommendation"]
        if body.decision == "approve":
            if analysis.get("missingFields"):
                raise HTTPException(
                    status_code=409,
                    detail="Missing fields must be resolved before approval.",
                )
            if recommendation in ("REJECT", "REQUEST_INFO", "NEEDS_REVIEW"):
                if not body.override:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Recommendation is {recommendation}. "
                            "An owner override with a written reason is required."
                        ),
                    )
                if not body.note.strip():
                    raise HTTPException(
                        status_code=400,
                        detail="An override requires a written reason.",
                    )

        suggested_reply = None
        if body.decision == "approve":
            order["status"] = "approved"
            details = body.note or (
                f"Approved by {identity['actor']} ({identity['role']})."
            )
            if body.override:
                details += " [owner override]"
            _log(
                data,
                identity["actor"],
                identity["role"],
                "order_approved",
                "order",
                order_id,
                details,
            )
            _create_purchase_drafts(data, order, analysis)
        elif body.decision == "reject":
            order["status"] = "rejected"
            _log(
                data,
                identity["actor"],
                identity["role"],
                "order_rejected",
                "order",
                order_id,
                body.note
                or f"Rejected by {identity['actor']} ({identity['role']}).",
            )
        else:
            order["status"] = "info_requested"
            business_name = data["meta"].get("businessName") or get_industry(
                data["meta"].get("industry")
            ).get("businessName", "the business")
            suggested_reply = _suggested_reply(
                order, analysis, str(business_name)
            )
            _log(
                data,
                identity["actor"],
                identity["role"],
                "info_requested",
                "order",
                order_id,
                body.note or "Customer information requested.",
            )

        order["approval"] = {
            "decision": body.decision,
            "actor": identity["actor"],
            "role": identity["role"],
            "note": body.note,
            "override": body.override,
            "decidedAt": now_iso(),
        }
        order["updatedAt"] = now_iso()
        return {"order": order, "suggestedReply": suggested_reply}

    return store.update(mutate)


def _create_purchase_drafts(data: dict, order: dict, analysis: dict) -> None:
    grouped: dict[str, list[dict]] = {}
    for stock in analysis.get("stock", []):
        if stock.get("suggestedPurchaseQty", 0) <= 0:
            continue
        grouped.setdefault(stock["supplierId"], []).append(stock)

    suppliers = {supplier["id"]: supplier for supplier in data["suppliers"]}
    for supplier_id, lines in grouped.items():
        supplier = suppliers.get(supplier_id, {})
        draft = {
            "id": next_id("PD", [d for o in data["orders"] for d in o.get("purchaseDrafts", [])]),
            "orderId": order["id"],
            "supplierId": supplier_id,
            "supplierName": supplier.get("name", "Unknown supplier"),
            "items": [
                {
                    "sku": line["sku"],
                    "name": line["name"],
                    "quantity": line["suggestedPurchaseQty"],
                    "unitCost": line["unitCost"],
                }
                for line in lines
            ],
            "totalCost": round(sum(line["purchaseCost"] for line in lines), 2),
            "expectedDate": (
                date.today()
                + timedelta(days=int(supplier.get("leadTimeDays", 0)))
            ).isoformat(),
            "status": "draft",
            "createdAt": now_iso(),
        }
        order.setdefault("purchaseDrafts", []).append(draft)
        _log(
            data,
            "SmartOrder Hub",
            "system",
            "purchase_draft_created",
            "order",
            order["id"],
            f"{draft['id']} for {draft['supplierName']}, "
            f"RM{draft['totalCost']:,.2f}, expected {draft['expectedDate']}.",
        )


def _suggested_reply(
    order: dict, analysis: dict, business_name: str = "the business"
) -> str:
    missing = analysis.get("missingFields") or []
    ask = ", ".join(missing) if missing else "the details needed to confirm your order"
    return (
        f"Hi {order.get('customerName', 'there')}, thanks for your order "
        f"{order['id']}. Could you please confirm {ask}? "
        "Once we have it, we will confirm the delivery. "
        f"— {business_name}"
    )


@app.get("/api/orders/{order_id}/activity")
def order_activity(order_id: str) -> list[dict]:
    data = store.read()
    order = _order_or_404(data, order_id)
    events = [
        event
        for event in data["activity"]
        if (event["entityType"] == "order" and event["entityId"] == order_id)
        or (
            event["entityType"] == "message"
            and event["entityId"] == order.get("messageId")
        )
    ]
    return sorted(events, key=lambda item: item.get("ts", ""))


@app.get("/api/activity")
def all_activity(
    limit: int = Query(default=1000, ge=1, le=5000),
) -> list[dict]:
    data = store.read()
    return sorted(
        data["activity"], key=lambda item: item.get("ts", ""), reverse=True
    )[:limit]


@app.post("/api/demo/reset")
def reset_demo(
    _owner: dict[str, str] = Depends(_require_owner),
) -> dict[str, Any]:
    email_connector.clear_session_config()
    current = store.read()["meta"].get("industry", "fnb")
    data = store.reset(current)
    _clear_risk_cache()
    return {
        "status": "reset",
        "industry": current,
        "messages": len(data["messages"]),
        "products": len(data["products"]),
        "suppliers": len(data["suppliers"]),
    }


# Serve the Vite build from the same origin in production / on Replit.
if (config.FRONTEND_DIST / "index.html").exists():
    assets_dir = config.FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(config.FRONTEND_DIST / "index.html")

    @app.get("/{path:path}")
    def spa(path: str) -> FileResponse:
        if (
            path == "api"
            or path.startswith("api/")
            or path in ("docs", "redoc", "openapi.json")
        ):
            raise HTTPException(status_code=404)
        base = config.FRONTEND_DIST.resolve()
        candidate = (base / path).resolve()
        if candidate.is_relative_to(base) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(base / "index.html")

else:

    @app.get("/")
    def root() -> dict:
        return {
            "service": "smartorder-hub",
            "message": "Frontend build not found. Run `bun run build` in frontend/.",
        }
