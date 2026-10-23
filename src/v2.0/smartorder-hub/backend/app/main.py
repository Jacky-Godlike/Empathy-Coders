"""SmartOrder Hub API.

The demo journey:
  message -> extraction -> order draft -> rule analysis -> human decision
  -> order record + purchase drafts + activity log + CSV export.
"""

from __future__ import annotations

import csv
import io
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import ai_client, config, extraction, rules
from .excel_export import generate_order_excel
from .industries import (
    INDUSTRIES,
    get_industry,
    industry_summary,
    list_industries,
)
from .models import (
    DecisionRequest,
    ExtractRequest,
    IndustryChange,
    MessageCreate,
    MessagePatch,
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
    industry = get_industry(data["meta"].get("industry"))
    return {
        "businessName": data["meta"].get("businessName")
        or industry["businessName"],
        "industry": industry_summary(industry),
        "industries": [industry_summary(item) for item in list_industries()],
        "ai": ai_client.status(),
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
        get_industry(data["meta"].get("industry"))
    )
    return payload


@app.get("/api/industries")
def industries() -> dict:
    return {"industries": [industry_summary(item) for item in list_industries()]}


@app.get("/api/workspace")
def workspace() -> dict:
    return _workspace(store.read())


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
            industry=get_industry(data["meta"].get("industry")),
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
        _log(
            data,
            "Staff",
            "staff",
            "message_reviewed",
            "message",
            message_id,
            "Staff updated the recognition result or notes.",
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
                industry=get_industry(data["meta"].get("industry")),
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
            )

            if _should_create_order(result) and not message.get("orderId"):
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
def decide_order(order_id: str, body: DecisionRequest) -> dict:
    if body.role == "staff" and body.decision in ("approve", "reject"):
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
