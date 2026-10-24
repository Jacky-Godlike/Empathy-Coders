"""Deterministic inventory, margin and delivery-date checks.

AI never produces these numbers. Every value below is derived from the
catalog, the supplier table, the customer's delivery date and the owner's
configured policy, so a judge can recompute it by hand.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timezone

from . import config
from .extraction import match_product
from .industries import get_industry
from .risk import assess_risk


def _find_supplier(suppliers: list[dict], supplier_id: str | None) -> dict | None:
    return next((s for s in suppliers if s["id"] == supplier_id), None)


def _as_int(value: object, default: int = 0) -> int:
    try:
        number = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError, OverflowError):
        return default
    return max(-1_000_000, min(1_000_000, number))


def _as_float(value: object, default: float = 0.0) -> float:
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError, OverflowError):
        return default
    if not math.isfinite(number):
        return default
    return max(-1_000_000_000.0, min(1_000_000_000.0, number))


def _check(code: str, level: str, message: str) -> dict:
    return {"code": code, "level": level, "message": message}


def analyze_order(
    order: dict,
    products: list[dict],
    suppliers: list[dict],
    min_margin: float | None = None,
    warn_margin: float | None = None,
    high_value_threshold: float | None = None,
    lead_buffer_days: int | None = None,
    min_confidence: float | None = None,
    industry: dict | None = None,
    history: list[dict] | None = None,
) -> dict:
    industry = industry or get_industry(order.get("industry"))
    min_margin = config.MIN_MARGIN if min_margin is None else min_margin
    warn_margin = config.WARN_MARGIN if warn_margin is None else warn_margin
    high_value_threshold = (
        config.HIGH_VALUE_THRESHOLD
        if high_value_threshold is None
        else high_value_threshold
    )
    lead_buffer_days = (
        config.LEAD_TIME_BUFFER_DAYS
        if lead_buffer_days is None
        else lead_buffer_days
    )
    min_confidence = (
        config.MIN_CONFIDENCE if min_confidence is None else min_confidence
    )

    today = date.today()
    checks: list[dict] = []
    stock_checks: list[dict] = []
    missing_fields: list[str] = []

    customer_name = str(order.get("customerName") or "").strip()
    items = order.get("items") or []
    if not isinstance(items, list):
        items = []
    delivery_type = order.get("deliveryType") or "unspecified"
    address = str(order.get("deliveryAddress") or "").strip()
    date_text = order.get("requestedDeliveryDate")
    confidence = _as_float(order.get("confidence"), 0.0)

    if not customer_name or customer_name == "Unknown":
        missing_fields.append("customer name")
    if not items:
        missing_fields.append("items")
    if delivery_type == "delivery" and not address:
        missing_fields.append("delivery address")
    if not date_text:
        missing_fields.append("delivery date")

    delivery_date: date | None = None
    if date_text:
        try:
            delivery_date = date.fromisoformat(str(date_text)[:10])
        except ValueError:
            missing_fields.append("delivery date")

    days_until = (delivery_date - today).days if delivery_date else None

    industry_fields = order.get("industryFields") or {}
    for key in industry.get("requiredFields", []):
        if not industry_fields.get(key):
            label = next(
                (
                    field["label"]
                    for field in industry.get("fields", [])
                    if field["key"] == key
                ),
                key,
            )
            if label.lower() not in missing_fields:
                missing_fields.append(label.lower())

    if missing_fields:
        checks.append(
            _check(
                "missing_fields",
                "fail",
                "Missing required information: " + ", ".join(missing_fields) + ".",
            )
        )
    else:
        checks.append(
            _check("missing_fields", "pass", "All required order fields are present.")
        )

    if confidence < min_confidence:
        checks.append(
            _check(
                "confidence",
                "fail",
                f"Extraction confidence {confidence:.0%} is below the "
                f"{min_confidence:.0%} threshold. Verify every field.",
            )
        )
    else:
        checks.append(
            _check(
                "confidence",
                "pass",
                f"Extraction confidence {confidence:.0%} is acceptable.",
            )
        )

    revenue = 0.0
    cost = 0.0
    unmatched = False
    stock_blocked = False
    needs_purchase = False
    invalid_item = False

    for item in items:
        if not isinstance(item, dict):
            invalid_item = True
            checks.append(
                _check(
                    "items",
                    "fail",
                    "An order line is malformed and must be corrected.",
                )
            )
            continue

        item_sku = item.get("sku") if isinstance(item.get("sku"), str) else None
        item_name = item.get("name") if isinstance(item.get("name"), str) else None
        product = match_product(products, item_sku) or match_product(
            products, item_name
        )
        quantity = _as_int(item.get("quantity"), 0)
        unit_price = _as_float(item.get("unitPrice"), 0.0)

        if quantity <= 0:
            invalid_item = True
            checks.append(
                _check(
                    f"quantity:{item.get('sku') or item.get('name') or 'item'}",
                    "fail",
                    "Every order line must have a positive quantity.",
                )
            )
            continue
        if unit_price < 0:
            invalid_item = True
            checks.append(
                _check(
                    f"price:{item.get('sku') or item.get('name') or 'item'}",
                    "fail",
                    "Unit price cannot be negative.",
                )
            )
            continue

        if not product:
            unmatched = True
            checks.append(
                _check(
                    f"catalog:{item.get('sku') or item.get('name')}",
                    "fail",
                    f"Product '{item.get('name')}' is not in the catalog. "
                    "Match it before accepting the order.",
                )
            )
            continue

        supplier = _find_supplier(suppliers, product.get("supplierId"))
        available = max(0, int(product.get("stock", 0)) - int(product.get("safetyStock", 0)))
        shortfall = max(0, quantity - available)
        lead_time = int(supplier["leadTimeDays"]) if supplier else 999
        moq = int(supplier["moq"]) if supplier else 1

        can_replenish = shortfall == 0 or (
            days_until is not None and lead_time + lead_buffer_days <= days_until
        )
        purchase_qty = 0
        if shortfall > 0:
            # Cover the shortfall, but never order less than the supplier MOQ.
            purchase_qty = max(moq, shortfall)
            needs_purchase = True

        stock_checks.append(
            {
                "sku": product["sku"],
                "name": product["name"],
                "required": quantity,
                "available": available,
                "shortfall": shortfall,
                "supplierId": supplier["id"] if supplier else "",
                "supplierName": supplier["name"] if supplier else "Unknown supplier",
                "leadTimeDays": lead_time,
                "canReplenishInTime": can_replenish,
                "suggestedPurchaseQty": purchase_qty,
                "unitCost": float(product["unitCost"]),
                "purchaseCost": round(purchase_qty * float(product["unitCost"]), 2),
            }
        )

        if shortfall == 0:
            checks.append(
                _check(
                    f"stock:{product['sku']}",
                    "pass",
                    f"{product['name']}: {quantity} needed, {available} available "
                    "after safety stock.",
                )
            )
        elif can_replenish:
            checks.append(
                _check(
                    f"stock:{product['sku']}",
                    "warn",
                    f"{product['name']}: short by {shortfall}. {supplier['name']} "
                    f"can deliver in {lead_time} day(s), inside the "
                    f"{days_until} day(s) to the requested date.",
                )
            )
        else:
            stock_blocked = True
            checks.append(
                _check(
                    f"stock:{product['sku']}",
                    "fail",
                    f"{product['name']}: short by {shortfall}. Supplier lead time "
                    f"is {lead_time} day(s) + {lead_buffer_days} buffer, but the "
                    f"customer wants it in {days_until} day(s).",
                )
            )

        revenue += quantity * unit_price
        cost += quantity * float(product["unitCost"])

    revenue = round(revenue, 2)
    cost = round(cost, 2)
    profit = round(revenue - cost, 2)
    margin = round(profit / revenue, 4) if revenue > 0 else 0.0

    if margin < min_margin:
        checks.append(
            _check(
                "margin",
                "fail",
                f"Gross margin {margin:.1%} is below the {min_margin:.0%} minimum.",
            )
        )
    elif margin < warn_margin:
        checks.append(
            _check(
                "margin",
                "warn",
                f"Gross margin {margin:.1%} is above the {min_margin:.0%} minimum "
                f"but below the {warn_margin:.0%} comfort line.",
            )
        )
    else:
        checks.append(
            _check(
                "margin",
                "pass",
                f"Gross margin {margin:.1%} is above the {warn_margin:.0%} comfort line.",
            )
        )

    if revenue > high_value_threshold:
        checks.append(
            _check(
                "order_value",
                "warn",
                f"Order value RM{revenue:,.2f} exceeds RM{high_value_threshold:,.0f}; "
                "owner approval is required.",
            )
        )
    else:
        checks.append(
            _check(
                "order_value",
                "pass",
                f"Order value RM{revenue:,.2f} is within the standard approval limit.",
            )
        )

    risk = assess_risk(
        order=order,
        industry=industry,
        products=products,
        history=history,
        stock=stock_checks,
        missing_fields=missing_fields,
        confidence=confidence,
        revenue=revenue,
        margin=margin,
        days_until=days_until,
        min_margin=min_margin,
        warn_margin=warn_margin,
        high_value_threshold=high_value_threshold,
    )
    if missing_fields:
        recommendation = "REQUEST_INFO"
    elif invalid_item or unmatched:
        recommendation = "NEEDS_REVIEW"
    elif confidence < min_confidence:
        recommendation = "NEEDS_REVIEW"
    elif stock_blocked or risk["capacityBlocked"]:
        recommendation = "REJECT"
    elif margin < min_margin:
        recommendation = "REJECT"
    elif risk["band"] in ("High", "Critical"):
        recommendation = "NEEDS_REVIEW"
    elif needs_purchase:
        recommendation = "ACCEPT_WITH_PURCHASE"
    else:
        recommendation = "ACCEPT"

    # A hard blocker must not be presented as "Low risk" in the table.
    raw_risk_score = risk["score"]
    floor_applied = False
    if recommendation in ("REJECT", "NEEDS_REVIEW") and risk["band"] in (
        "Low",
        "Medium",
    ):
        risk["score"] = max(risk["score"], 50.0)
        risk["band"] = "High"
        floor_applied = True
    elif recommendation == "REQUEST_INFO" and risk["band"] == "Low":
        risk["score"] = max(risk["score"], 25.0)
        risk["band"] = "Medium"
        floor_applied = True

    risk_level = (
        "pass"
        if risk["band"] == "Low"
        else "warn"
        if risk["band"] == "Medium"
        else "fail"
    )
    checks.append(
        _check(
            "risk",
            risk_level,
            f"Composite risk {risk['score']:.0f}/100 ({risk['band']}).",
        )
    )
    if floor_applied:
        checks.append(
            _check(
                "risk_floor",
                "warn",
                f"A hard blocker raises the risk band to {risk['band']}.",
            )
        )
    for index, warning in enumerate(risk["warnings"], start=1):
        checks.append(_check(f"risk_warning_{index}", "warn", warning))

    reasons = [c["message"] for c in checks if c["level"] != "pass"]
    if not reasons:
        reasons = ["All checks passed; the order is ready for human approval."]

    return {
        "recommendation": recommendation,
        "reasons": reasons,
        "checks": checks,
        "stock": stock_checks,
        "revenue": revenue,
        "cost": cost,
        "profit": profit,
        "margin": margin,
        "riskScore": risk["score"],
        "rawRiskScore": raw_risk_score,
        "riskBand": risk["band"],
        "riskFactors": risk["factors"],
        "daysUntilDelivery": days_until,
        "missingFields": missing_fields,
        "confidence": confidence,
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
    }
