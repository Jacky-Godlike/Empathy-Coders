"""SmartOrder Hub API.

The demo journey:
  message -> extraction -> order draft -> rule analysis -> human decision
  -> order record + purchase drafts + activity log + CSV export.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import math
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import ai_client, channels as channel_service, config, extraction, rules
from .excel_export import generate_order_excel
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
    ExtractRequest,
    IndustryChange,
    MessageCreate,
    MessagePatch,
    OrderOutcome,
    RiskPolicyUpdate,
)
from .orbyte_adapter import MockOrbyteAdapter
from .store import Store, find_by_id, next_id, product_by_sku

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smartorder-hub")

app = FastAPI(title="SmartOrder Hub API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = Store(config.DATA_DIR)

DEFAULT_RISK_POLICY = {
    "minMargin": config.MIN_MARGIN,
    "warnMargin": config.WARN_MARGIN,
    "highValueThreshold": config.HIGH_VALUE_THRESHOLD,
    "leadTimeBufferDays": config.LEAD_TIME_BUFFER_DAYS,
    "minConfidence": config.MIN_CONFIDENCE,
    "riskMediumThreshold": config.RISK_MEDIUM_THRESHOLD,
    "riskHighThreshold": config.RISK_HIGH_THRESHOLD,
    "riskCriticalThreshold": config.RISK_CRITICAL_THRESHOLD,
}
RISK_FACTOR_KEYS = {"stock", "delivery", "margin", "data", "anomaly"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _risk_policy(data: dict) -> dict:
    return {**DEFAULT_RISK_POLICY, **data.get("meta", {}).get("riskPolicy", {})}


def _industry_for_data(data: dict) -> dict:
    profile = get_industry(data["meta"].get("industry"))
    configured_weights = data.get("meta", {}).get("riskWeights", {}).get(
        profile["id"]
    )
    return (
        {**profile, "riskWeights": configured_weights}
        if configured_weights
        else profile
    )


def _analysis_policy_kwargs(data: dict) -> dict:
    policy = _risk_policy(data)
    return {
        "min_margin": policy["minMargin"],
        "warn_margin": policy["warnMargin"],
        "high_value_threshold": policy["highValueThreshold"],
        "lead_buffer_days": policy["leadTimeBufferDays"],
        "min_confidence": policy["minConfidence"],
        "risk_medium_threshold": policy["riskMediumThreshold"],
        "risk_high_threshold": policy["riskHighThreshold"],
        "risk_critical_threshold": policy["riskCriticalThreshold"],
    }


def _log(
    data: dict,
    actor: str,
    role: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: str,
    evidence: dict | None = None,
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
        "evidence": evidence or {},
        "previousHash": data["activity"][-1].get("hash", "") if data["activity"] else "",
    }
    canonical = json.dumps(event, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    event["hash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
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

    message = {
        "id": next_id("MSG", data["messages"]),
        "source": channel["source"],
        "sender": (payload.get("sender") or "Unknown").strip() or "Unknown",
        "contact": payload.get("contact"),
        "channelId": channel["id"],
        "channelAccount": channel["account"],
        "externalId": external_id,
        "timestamp": payload.get("timestamp") or now_iso(),
        "originalText": (payload.get("originalText") or "").strip(),
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


def _sync_channel_message(data: dict, channel: dict) -> dict:
    sample = channel_service.next_sample(channel)
    message = _append_channel_message(data, channel, sample)
    channel_service.mark_synced(channel)
    _log(
        data,
        "Channel collector",
        "system",
        "channel_sync",
        "channel",
        channel["id"],
        f"Imported one message from {channel['name']}",
    )
    return message


def _intake_summary(data: dict) -> dict:
    by_type: dict[str, int] = {}
    unprocessed = 0

    for message in data["messages"]:
        parsed = message.get("parsedData")
        if not parsed:
            unprocessed += 1
            continue
        message_type = parsed.get("messageType", "uncertain")
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
    industry = _industry_for_data(data)
    return {
        "businessName": data["meta"].get("businessName")
        or industry["businessName"],
        "industry": industry_summary(industry),
        "industries": [industry_summary(item) for item in list_industries()],
        "ai": ai_client.status(),
        "rules": _risk_policy(data),
        "stats": _intake_summary(data),
    }


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "smartorder-hub",
        "aiMode": (
            ai_client.status()["provider"]
            if ai_client.configured()
            else "rules-only"
        ),
        "business": "Kopi Kita Enterprise",
    }


@app.get("/api/catalog")
def catalog() -> dict:
    data = store.read()
    payload = MockOrbyteAdapter(data).get_catalog()
    payload["industry"] = industry_summary(
        _industry_for_data(data)
    )
    return payload


@app.get("/api/industries")
def industries() -> dict:
    return {"industries": [industry_summary(item) for item in list_industries()]}


@app.get("/api/workspace")
def workspace() -> dict:
    return _workspace(store.read())


@app.patch("/api/risk-policy")
def update_risk_policy(body: RiskPolicyUpdate) -> dict:
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Provide at least one risk threshold.")
    if any(value is None for value in changes.values()):
        raise HTTPException(status_code=422, detail="Risk thresholds cannot be null.")
    risk_weights = changes.pop("riskWeights", None)
    if risk_weights is not None and (
        set(risk_weights) != RISK_FACTOR_KEYS
        or any(
            not math.isfinite(value) or value < 0 or value > 1
            for value in risk_weights.values()
        )
        or abs(sum(risk_weights.values()) - 1) > 1e-6
    ):
        raise HTTPException(
            status_code=400,
            detail="Risk weights must define all five factors, stay in [0, 1], and sum to 1.",
        )
    if not changes and risk_weights is None:
        raise HTTPException(status_code=400, detail="Provide at least one risk threshold.")

    def mutate(data: dict) -> dict:
        before = _risk_policy(data)
        policy = before.copy()
        policy.update(changes)
        if policy["warnMargin"] < policy["minMargin"]:
            raise HTTPException(
                status_code=400,
                detail="Warn margin must be greater than or equal to minimum margin.",
            )
        if not (
            policy["riskMediumThreshold"]
            < policy["riskHighThreshold"]
            < policy["riskCriticalThreshold"]
        ):
            raise HTTPException(
                status_code=400,
                detail="Risk score thresholds must increase: medium < high < critical.",
            )
        data["meta"]["riskPolicy"] = policy
        before_weights = _industry_for_data(data)["riskWeights"]
        if risk_weights is not None:
            data["meta"].setdefault("riskWeights", {})[
                data["meta"].get("industry", "fnb")
            ] = risk_weights
        _log(
            data,
            "Demo Owner",
            "owner",
            "risk_policy_updated",
            "settings",
            "risk-policy",
            "Risk policy updated: " + ", ".join(sorted(changes or {"riskWeights"})),
            evidence={
                "before": {"thresholds": before, "riskWeights": before_weights},
                "after": {
                    "thresholds": policy,
                    "riskWeights": risk_weights or before_weights,
                },
            },
        )
        return _workspace(data)

    return store.update(mutate)


@app.post("/api/industry")
def switch_industry(body: IndustryChange) -> dict:
    if body.industry not in INDUSTRIES:
        raise HTTPException(status_code=400, detail="Unknown industry")
    data = store.reset(body.industry)
    return {"status": "switched", "workspace": _workspace(data)}


@app.get("/api/ai/status")
def ai_status() -> dict:
    return ai_client.status()


@app.post("/api/ai/test")
def ai_test() -> dict:
    """Make one tiny provider call so Settings can verify the connection."""

    try:
        return ai_client.test_connection()
    except ai_client.AIClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - report provider failures
        logger.exception("AI connection test failed")
        raise HTTPException(
            status_code=502, detail=f"AI connection test failed: {exc}"
        ) from exc


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
def connect_channel(channel_id: str) -> dict:
    def mutate(data: dict) -> dict:
        channel = _channel_or_404(data, channel_id)
        channel_service.mark_connected(channel)
        _log(
            data,
            "Demo Owner",
            "owner",
            "channel_connected",
            "channel",
            channel_id,
            f"Connected {channel['name']} for read-only order collection",
        )
        return channel_service.channel_public_view(channel)

    return store.update(mutate)


@app.post("/api/channels/{channel_id}/disconnect")
def disconnect_channel(channel_id: str) -> dict:
    def mutate(data: dict) -> dict:
        channel = _channel_or_404(data, channel_id)
        channel_service.mark_disconnected(channel)
        _log(
            data,
            "Demo Owner",
            "owner",
            "channel_disconnected",
            "channel",
            channel_id,
            f"Disconnected {channel['name']}",
        )
        return channel_service.channel_public_view(channel)

    return store.update(mutate)


@app.patch("/api/channels/{channel_id}")
def update_channel(channel_id: str, body: ChannelSettings) -> dict:
    def mutate(data: dict) -> dict:
        channel = _channel_or_404(data, channel_id)
        if body.autoSync is not None:
            if body.autoSync and channel["status"] != "connected":
                raise HTTPException(
                    status_code=409,
                    detail="Connect the channel before enabling auto-sync.",
                )
            channel["autoSync"] = body.autoSync
        return channel_service.channel_public_view(channel)

    return store.update(mutate)


@app.post("/api/channels/{channel_id}/sync")
def sync_channel(channel_id: str) -> dict:
    def mutate(data: dict) -> dict:
        channel = _channel_or_404(data, channel_id)
        if channel["status"] != "connected":
            raise HTTPException(
                status_code=409,
                detail="Reconnect this channel before syncing.",
            )
        message = _sync_channel_message(data, channel)
        return {
            "channel": channel_service.channel_public_view(channel),
            "messages": [message],
        }

    return store.update(mutate)


@app.post("/api/channels/sync-all")
def sync_all_channels() -> dict:
    def mutate(data: dict) -> dict:
        channel_service.initial_channel_timestamps(data)
        channels = channel_service.ensure_channels(data)
        connected = [
            channel for channel in channels if channel["status"] == "connected"
        ]
        messages = [_sync_channel_message(data, channel) for channel in connected]
        if connected:
            _log(
                data,
                "Channel collector",
                "system",
                "channel_sync_all",
                "workspace",
                data["meta"].get("industry", "fnb"),
                f"Imported {len(messages)} messages from {len(connected)} channels",
            )
        return {
            "channels": [
                channel_service.channel_public_view(channel)
                for channel in channels
            ],
            "messages": messages,
            "syncedChannels": len(connected),
        }

    return store.update(mutate)


@app.post("/api/channels/{channel_id}/webhook", status_code=201)
def channel_webhook(
    channel_id: str,
    body: ChannelWebhookMessage,
    x_webhook_token: str | None = Header(default=None, alias="X-Webhook-Token"),
) -> dict:
    """Production-style ingest endpoint.

    Platform adapters should forward a signed/normalised payload here. The
    demo accepts the request directly; set SMARTORDERHUB_CHANNEL_WEBHOOK_TOKEN
    to require an X-Webhook-Token header.
    """

    if config.CHANNEL_WEBHOOK_TOKEN and x_webhook_token != config.CHANNEL_WEBHOOK_TOKEN:
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


@app.get("/api/messages")
def list_messages() -> list[dict]:
    data = store.read()
    return sorted(
        data["messages"], key=lambda item: item.get("timestamp", ""), reverse=True
    )


@app.post("/api/messages", status_code=201)
def create_message(body: MessageCreate) -> dict:
    def mutate(data: dict) -> dict:
        message = {
            "id": next_id("MSG", data["messages"]),
            "source": body.source,
            "sender": body.sender.strip() or "Unknown",
            "contact": body.contact,
            "channelAccount": body.channelAccount,
            "externalId": body.externalId,
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
    def mutate(data: dict) -> dict:
        message = _message_or_404(data, message_id)
        if message.get("orderId"):
            raise HTTPException(
                status_code=409,
                detail="This message already has an order. Reject or reset it first.",
            )

        result = extraction.extract_message(
            text=message["originalText"],
            sender=message["sender"],
            contact=message.get("contact"),
            products=data["products"],
            mode=body.mode,
            industry=_industry_for_data(data),
        )
        message["parsedData"] = result["parsedData"]
        message["status"] = result["status"]
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
            evidence={
                "sourceMessage": message.get("originalText", ""),
                "extraction": parsed,
            },
        )
        return message

    return store.update(mutate)


@app.patch("/api/messages/{message_id}")
def patch_message(message_id: str, body: MessagePatch) -> dict:
    def mutate(data: dict) -> dict:
        message = _message_or_404(data, message_id)
        if body.status is not None:
            message["status"] = body.status
        if body.reviewNotes is not None:
            message["reviewNotes"] = body.reviewNotes
        if body.parsedData is not None:
            message["parsedData"] = body.parsedData
        if body.extractionAccurate is not None:
            message["extractionAccurate"] = body.extractionAccurate
            message["extractionReviewedAt"] = now_iso()
            message["extractionReviewedBy"] = "Staff"
        _log(
            data,
            "Staff",
            "staff",
            "message_reviewed",
            "message",
            message_id,
            "Staff updated the recognition result or notes.",
            evidence={
                "extractionAccurate": message.get("extractionAccurate"),
                "parsedData": message.get("parsedData"),
            },
        )
        return message

    return store.update(mutate)


@app.delete("/api/messages/{message_id}", status_code=204)
def delete_message(message_id: str) -> None:
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
            "Staff",
            "staff",
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
    items = []
    for raw in parsed.get("items", []):
        product = product_by_sku(data["products"], raw.get("sku")) or extraction.match_product(
            data["products"], raw.get("name")
        )
        sku = product["sku"] if product else (raw.get("sku") or "UNMATCHED")
        name = product["name"] if product else raw.get("name") or "Unknown item"
        quantity = int(raw.get("quantity") or 0)
        price_value = raw.get("unitPrice")
        if price_value is not None and float(price_value) > 0:
            unit_price = float(price_value)
        else:
            unit_price = float(product["sellPrice"]) if product else 0.0
        items.append(
            {
                "sku": sku,
                "name": name,
                "quantity": quantity,
                "unitPrice": round(unit_price, 2),
                "lineTotal": round(quantity * unit_price, 2),
            }
        )

    order = {
        "id": next_id("ORD", data["orders"]),
        "messageId": message["id"],
        "source": message.get("source", "manual"),
        "industry": data["meta"].get("industry", "fnb"),
        "extractionMethod": parsed.get("method", "rules"),
        "industryFields": parsed.get("industryFields") or {},
        "customerName": parsed.get("customerName")
        or message.get("sender")
        or "Unknown",
        "contact": parsed.get("contact") or message.get("contact"),
        "items": items,
        "deliveryType": parsed.get("deliveryType") or "unspecified",
        "deliveryAddress": parsed.get("deliveryAddress") or "",
        "requestedDeliveryDate": parsed.get("requestedDeliveryDate"),
        "notes": parsed.get("customerNotes") or "",
        "confidence": round(float(parsed.get("confidenceScore") or 0) / 100, 2),
        "extractionSnapshot": parsed,
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
        evidence={
            "sourceMessageId": message["id"],
            "extraction": parsed,
            "order": order,
        },
    )
    return order


def _should_create_order(result: dict) -> bool:
    """Only turn complete-enough orders into table rows.

    A message with no catalogue match or no quantity stays in the raw inbox for
    human review; it must not become a misleading row in the order table.
    """

    if result.get("status") not in ("recognized_as_order", "needs_human_review"):
        return False
    parsed = result.get("parsedData") or {}
    if not parsed.get("items"):
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

    def mutate(data: dict) -> dict:
        processed = 0
        created = 0
        by_type: dict[str, int] = {}

        for message in data["messages"]:
            if message.get("parsedData"):
                continue

            result = extraction.extract_message(
                text=message["originalText"],
                sender=message["sender"],
                contact=message.get("contact"),
                products=data["products"],
                mode=config.INTAKE_MODE,
                industry=_industry_for_data(data),
            )
            message["parsedData"] = result["parsedData"]
            message["status"] = result["status"]
            parsed = result["parsedData"] or {}
            message_type = parsed.get("messageType", "uncertain")
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
                evidence={
                    "sourceMessage": message.get("originalText", ""),
                    "extraction": parsed,
                },
            )

            if _should_create_order(result) and not message.get("orderId"):
                order = _build_order(data, message)
                analysis = rules.analyze_order(
                    order,
                    data["products"],
                    data["suppliers"],
                    **_analysis_policy_kwargs(data),
                    industry=_industry_for_data(data),
                    history=data["orders"],
                    source_text=message.get("originalText", ""),
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
                    evidence={"analysis": analysis},
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
def list_orders() -> list[dict]:
    data = store.read()
    return sorted(
        data["orders"], key=lambda item: item.get("createdAt", ""), reverse=True
    )


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
            "risk_triggers",
            "handling",
            "actual_delivered_on_time",
            "actual_profit_myr",
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
                order["id"],
                order["status"],
                order["customerName"],
                order.get("requestedDeliveryDate") or "",
                items,
                analysis.get("revenue", ""),
                analysis.get("cost", ""),
                analysis.get("profit", ""),
                f"{analysis.get('margin', 0):.2%}" if analysis else "",
                analysis.get("recommendation", ""),
                approval.get("actor", ""),
                _csv_safe("; ".join(
                    trigger["detail"]
                    for trigger in analysis.get("riskTriggers", [])
                )),
                _csv_safe(
                    f"Owner override: {approval.get('specialReason')}; {approval.get('note')}"
                    if approval.get("override")
                    else approval.get("decision", "")
                ),
                (order.get("actualOutcome") or {}).get("actualDeliveredOnTime", ""),
                (order.get("actualOutcome") or {}).get("actualProfit", ""),
                order.get("createdAt", ""),
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


def _csv_safe(value: Any) -> Any:
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r", "\n")):
        if re.match(r"^\+\d[\d\s()-]{7,}$", value.strip()):
            return value
        return "'" + value
    return value


@app.get("/api/reports/risk")
def risk_report(period: str = "month") -> dict:
    if period not in ("week", "month"):
        raise HTTPException(status_code=400, detail="Period must be 'week' or 'month'.")
    data = store.read()
    cutoff = datetime.now(timezone.utc) - timedelta(days=7 if period == "week" else 30)
    orders = [
        order
        for order in data["orders"]
        if _within_period(
            (order.get("analysis") or {}).get("analyzedAt")
            or order.get("createdAt"),
            cutoff,
        )
    ]
    trigger_counts: dict[str, dict] = {}
    for order in orders:
        for trigger in (order.get("analysis") or {}).get("riskTriggers", []):
            category = trigger["category"]
            item = trigger_counts.setdefault(
                category, {"category": category, "count": 0, "examples": []}
            )
            item["count"] += 1
            if trigger["detail"] not in item["examples"] and len(item["examples"]) < 3:
                item["examples"].append(trigger["detail"])

    overrides = [
        order
        for order in data["orders"]
        if (order.get("approval") or {}).get("override")
        and _within_period(
            (order.get("approval") or {}).get("decidedAt"),
            cutoff,
        )
    ]
    rated_messages = [
        message
        for message in data["messages"]
        if message.get("extractionAccurate") is not None
        and _within_period(message.get("extractionReviewedAt"), cutoff)
    ]
    accurate_count = sum(
        1 for message in rated_messages if message["extractionAccurate"] is True
    )
    period_days = 7 if period == "week" else 30
    bucket_days = 1 if period == "week" else 7
    bucket_count = (period_days + bucket_days - 1) // bucket_days
    accuracy_buckets = [
        {
            "label": (cutoff + timedelta(days=index * bucket_days)).date().isoformat(),
            "reviewed": 0,
            "accurate": 0,
        }
        for index in range(bucket_count)
    ]
    for message in rated_messages:
        reviewed_at = _parse_timestamp(message.get("extractionReviewedAt"))
        if not reviewed_at:
            continue
        bucket_index = min(
            (reviewed_at.date() - cutoff.date()).days // bucket_days,
            bucket_count - 1,
        )
        accuracy_buckets[bucket_index]["reviewed"] += 1
        if message["extractionAccurate"] is True:
            accuracy_buckets[bucket_index]["accurate"] += 1
    accuracy_trend = [
        {
            **bucket,
            "rate": (
                bucket["accurate"] / bucket["reviewed"]
                if bucket["reviewed"]
                else None
            ),
        }
        for bucket in accuracy_buckets
    ]
    return {
        "period": period,
        "generatedAt": now_iso(),
        "ordersReviewed": len(orders),
        "riskTriggerTop5": sorted(
            trigger_counts.values(), key=lambda item: (-item["count"], item["category"])
        )[:5],
        "specialApprovals": [
            {
                "orderId": order["id"],
                "reason": order["approval"].get("specialReason"),
                "expectedProfit": (order.get("analysis") or {}).get("profit"),
                "actualProfit": (order.get("actualOutcome") or {}).get("actualProfit"),
                "actualDeliveredOnTime": (order.get("actualOutcome") or {}).get(
                    "actualDeliveredOnTime"
                ),
            }
            for order in overrides
        ],
        "specialApprovalExpectedProfit": round(
            sum((order.get("analysis") or {}).get("profit", 0) for order in overrides), 2
        ),
        "specialApprovalActualProfit": round(
            sum(
                (order.get("actualOutcome") or {}).get("actualProfit", 0)
                for order in overrides
                if (order.get("actualOutcome") or {}).get("actualProfit") is not None
            ),
            2,
        ),
        "extractionAccuracy": {
            "reviewed": len(rated_messages),
            "accurate": accurate_count,
            "rate": accurate_count / len(rated_messages) if rated_messages else None,
        },
        "extractionAccuracyTrend": accuracy_trend,
    }


def _parse_timestamp(timestamp: str | None) -> datetime | None:
    if not timestamp:
        return None
    try:
        value = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _within_period(timestamp: str | None, cutoff: datetime) -> bool:
    value = _parse_timestamp(timestamp)
    return value is not None and value >= cutoff


@app.get("/api/audit/verify")
def verify_audit_log() -> dict:
    events = store.read()["activity"]
    previous_hash = ""
    checked = 0
    legacy = 0
    for event in events:
        stored_hash = event.get("hash")
        if not stored_hash:
            legacy += 1
            previous_hash = ""
            continue
        if event.get("previousHash", "") != previous_hash:
            return {"valid": False, "checked": checked, "legacyEvents": legacy}
        payload = {key: value for key, value in event.items() if key != "hash"}
        canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        actual_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        if actual_hash != stored_hash:
            return {"valid": False, "checked": checked, "legacyEvents": legacy}
        previous_hash = stored_hash
        checked += 1
    return {"valid": True, "checked": checked, "legacyEvents": legacy}


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
            **_analysis_policy_kwargs(data),
            industry=_industry_for_data(data),
            history=data["orders"],
            source_text=(
                find_by_id(data["messages"], order.get("messageId")) or {}
            ).get("originalText", ""),
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
            evidence={"analysis": analysis},
        )
        return order

    return store.update(mutate)


@app.post("/api/orders/{order_id}/decision")
def decide_order(order_id: str, body: DecisionRequest) -> dict:
    if body.role == "staff" and body.decision in ("approve", "reject"):
        raise HTTPException(
            status_code=403,
            detail="Staff may request information but cannot approve or reject.",
        )
    if body.override and body.role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner may override a risk blocker.")
    if body.override and not body.specialReason:
        raise HTTPException(
            status_code=400,
            detail="Select a special-approval reason before overriding a risk blocker.",
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
            if analysis.get("complianceBlocked"):
                raise HTTPException(
                    status_code=409,
                    detail="Compliance flags cannot be overridden; reject or escalate this request.",
                )
            if analysis.get("missingFields"):
                raise HTTPException(
                    status_code=409,
                    detail="Missing fields must be resolved before approval.",
                )
            if recommendation in ("REJECT", "REQUEST_INFO", "NEEDS_REVIEW"):
                medium_review = (
                    recommendation == "NEEDS_REVIEW"
                    and analysis.get("riskBand") == "Medium"
                )
                if medium_review and not body.note.strip():
                    raise HTTPException(
                        status_code=400,
                        detail="Record the adjustment or mitigation in the approval note.",
                    )
                if not medium_review and not body.override:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Recommendation is {recommendation}. "
                            "An owner override with a written reason is required."
                        ),
                    )
                if not medium_review and not body.note.strip():
                    raise HTTPException(
                        status_code=400,
                        detail="An override requires a written reason.",
                    )

        suggested_reply = None
        if body.decision == "approve":
            order["status"] = "approved"
            details = body.note or f"Approved by {body.actor} ({body.role})."
            if body.override:
                details += " [owner override]"
            _log(
                data,
                body.actor,
                body.role,
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
                body.actor,
                body.role,
                "order_rejected",
                "order",
                order_id,
                body.note or f"Rejected by {body.actor} ({body.role}).",
            )
        else:
            order["status"] = "info_requested"
            suggested_reply = _suggested_reply(order, analysis)
            _log(
                data,
                body.actor,
                body.role,
                "info_requested",
                "order",
                order_id,
                body.note or "Customer information requested.",
            )

        order["approval"] = {
            "decision": body.decision,
            "actor": body.actor,
            "role": body.role,
            "note": body.note,
            "override": body.override,
            "specialReason": body.specialReason,
            "decidedAt": now_iso(),
        }
        _log(
            data,
            body.actor,
            body.role,
            "decision_recorded",
            "order",
            order_id,
            f"{body.decision}; override={body.override}; "
            f"special reason={body.specialReason or 'not applicable'}",
            evidence={
                "decision": body.decision,
                "note": body.note,
                "override": body.override,
                "specialReason": body.specialReason,
                "riskBand": analysis.get("riskBand"),
                "riskTriggers": analysis.get("riskTriggers", []),
            },
        )
        order["updatedAt"] = now_iso()
        return {"order": order, "suggestedReply": suggested_reply}

    return store.update(mutate)


@app.patch("/api/orders/{order_id}/outcome")
def record_order_outcome(order_id: str, body: OrderOutcome) -> dict:
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Provide a delivery or profit outcome.")

    def mutate(data: dict) -> dict:
        order = _order_or_404(data, order_id)
        if order["status"] not in ("approved", "rejected"):
            raise HTTPException(
                status_code=409,
                detail="Record actual results only after a final order decision.",
            )
        outcome = order.setdefault("actualOutcome", {})
        outcome.update(changes)
        outcome["updatedAt"] = now_iso()
        _log(
            data,
            "Demo Owner",
            "owner",
            "order_outcome_recorded",
            "order",
            order_id,
            "Actual delivery/profit outcome updated.",
            evidence=outcome.copy(),
        )
        return order

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


def _suggested_reply(order: dict, analysis: dict) -> str:
    missing = analysis.get("missingFields") or []
    ask = ", ".join(missing) if missing else "the details needed to confirm your order"
    return (
        f"Hi {order.get('customerName', 'there')}, thanks for your order "
        f"{order['id']}. Could you please confirm {ask}? "
        "Once we have it, we will confirm the delivery. "
        "— Kopi Kita Enterprise"
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
def all_activity() -> list[dict]:
    data = store.read()
    return sorted(
        data["activity"], key=lambda item: item.get("ts", ""), reverse=True
    )


@app.post("/api/demo/reset")
def reset_demo() -> dict[str, Any]:
    current = store.read()["meta"].get("industry", "fnb")
    data = store.reset(current)
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
        if path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = config.FRONTEND_DIST / path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(config.FRONTEND_DIST / "index.html")

else:

    @app.get("/")
    def root() -> dict:
        return {
            "service": "smartorder-hub",
            "message": "Frontend build not found. Run `bun run build` in frontend/.",
        }
