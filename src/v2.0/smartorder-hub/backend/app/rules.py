"""Deterministic inventory, margin and delivery-date checks.

AI never produces these numbers. Every value below is derived from the
catalog, the supplier table, the customer's delivery date and the owner's
configured policy, so a judge can recompute it by hand.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from . import config
from .extraction import match_product
from .industries import get_industry
from .risk import assess_risk

SENSITIVE_TERMS = (
    "explosive",
    "firearm",
    "weapon",
    "illegal drugs",
    "counterfeit goods",
    "bahan letupan",
    "senjata api",
    "dadah haram",
    "违禁品",
    "爆炸物",
    "枪支",
    "非法毒品",
)


def _find_supplier(suppliers: list[dict], supplier_id: str | None) -> dict | None:
    return next((s for s in suppliers if s["id"] == supplier_id), None)


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
    risk_medium_threshold: float | None = None,
    risk_high_threshold: float | None = None,
    risk_critical_threshold: float | None = None,
    industry: dict | None = None,
    history: list[dict] | None = None,
    source_text: str = "",
) -> dict:
    industry = industry or get_industry(order.get("industry"))
    min_margin = config.MIN_MARGIN if min_margin is None else min_margin
    warn_margin = config.WARN_MARGIN if warn_margin is None else warn_margin
    high_value_threshold = (
        config.HIGH_VALUE_THRESHOLD
        if high_value_threshold is None
        else high_value_threshold
    )
    risk_medium_threshold = (
        config.RISK_MEDIUM_THRESHOLD
        if risk_medium_threshold is None
        else risk_medium_threshold
    )
    risk_high_threshold = (
        config.RISK_HIGH_THRESHOLD
        if risk_high_threshold is None
        else risk_high_threshold
    )
    risk_critical_threshold = (
        config.RISK_CRITICAL_THRESHOLD
        if risk_critical_threshold is None
        else risk_critical_threshold
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

    customer_name = (order.get("customerName") or "").strip()
    items = order.get("items") or []
    delivery_type = order.get("deliveryType") or "unspecified"
    address = (order.get("deliveryAddress") or "").strip()
    date_text = order.get("requestedDeliveryDate")
    confidence = float(order.get("confidence") or 0)

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

    for item in items:
        product = match_product(products, item.get("sku")) or match_product(
            products, item.get("name")
        )
        quantity = int(item.get("quantity") or 0)
        unit_price = float(item.get("unitPrice") or 0)

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
        min_confidence=min_confidence,
        risk_medium_threshold=risk_medium_threshold,
        risk_high_threshold=risk_high_threshold,
        risk_critical_threshold=risk_critical_threshold,
    )
    matched_terms = [
        term
        for term in SENSITIVE_TERMS
        if term.casefold() in source_text.casefold()
    ]
    compliance_blocked = bool(matched_terms)
    if compliance_blocked:
        checks.append(
            _check(
                "compliance:sensitive_term",
                "fail",
                "Potentially prohibited goods or services detected; owner review is mandatory.",
            )
        )
    if missing_fields:
        recommendation = "REQUEST_INFO"
    elif unmatched:
        recommendation = "NEEDS_REVIEW"
    elif confidence < min_confidence:
        recommendation = "NEEDS_REVIEW"
    elif compliance_blocked:
        recommendation = "REJECT"
    elif stock_blocked or risk["capacityBlocked"]:
        recommendation = "REJECT"
    elif margin < min_margin:
        recommendation = "REJECT"
    elif risk["band"] in ("Medium", "High", "Critical"):
        recommendation = "NEEDS_REVIEW"
    elif needs_purchase:
        recommendation = "ACCEPT_WITH_PURCHASE"
    else:
        recommendation = "ACCEPT"

    # A hard blocker must not be presented as "Low risk" in the table.
    raw_risk_score = risk["score"]
    floor_applied = False
    hard_blocker = (
        recommendation == "REJECT"
        or unmatched
        or confidence < min_confidence
        or compliance_blocked
    )
    if hard_blocker and risk["band"] in ("Low", "Medium"):
        risk["score"] = max(risk["score"], risk_high_threshold)
        risk["band"] = "High"
        floor_applied = True
    elif recommendation == "REQUEST_INFO" and risk["band"] == "Low":
        risk["score"] = max(risk["score"], risk_medium_threshold)
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

    short_lines = [line for line in stock_checks if line["shortfall"] > 0]
    earliest_delivery = None
    if short_lines:
        earliest_delivery = (
            date.today()
            + timedelta(
                days=max(line["leadTimeDays"] for line in short_lines)
                + lead_buffer_days
            )
        ).isoformat()

    response_actions = []
    if compliance_blocked:
        response_actions.append(
            {
                "strategy": "avoid",
                "action": "Do not accept this request; send a refusal for owner review.",
                "suggestedReply": "Thank you for your enquiry. We are unable to fulfil this request.",
            }
        )
    if missing_fields or confidence < min_confidence:
        response_actions.append(
            {
                "strategy": "mitigate",
                "action": "Return the order for customer-service clarification before approval.",
                "suggestedReply": (
                    "Please confirm: "
                    + (", ".join(missing_fields) or "the uncertain order details")
                    + "."
                ),
            }
        )
    if short_lines and earliest_delivery:
        response_actions.append(
            {
                "strategy": "mitigate",
                "action": f"Negotiate delivery no earlier than {earliest_delivery}.",
                "earliestCommitDate": earliest_delivery,
                "suggestedReply": (
                    f"We can currently commit to delivery on or after {earliest_delivery}. "
                    "Would that work for you?"
                ),
            }
        )
    if risk["noDeposit"]:
        response_actions.append(
            {
                "strategy": "transfer",
                "action": "Request full prepayment or use a third-party guaranteed transaction.",
            }
        )
    if risk["band"] == "Medium" and recommendation == "NEEDS_REVIEW":
        response_actions.append(
            {
                "strategy": "mitigate",
                "action": "Review the highlighted non-fatal factors and adjust the order terms before approval.",
            }
        )
    if recommendation == "REJECT" or risk["band"] in ("High", "Critical"):
        response_actions.append(
            {
                "strategy": "escalate",
                "action": "Route to the owner for a documented decision; do not auto-approve.",
            }
        )
    if recommendation in ("ACCEPT", "ACCEPT_WITH_PURCHASE"):
        response_actions.append(
            {"strategy": "accept", "action": "Record the exposure and proceed with owner confirmation."}
        )

    risk_triggers = [
        {
            "code": check["code"],
            "category": (
                "compliance"
                if check["code"].startswith("compliance")
                else "information"
                if check["code"] in ("missing_fields", "confidence")
                else "profit"
                if check["code"] == "margin"
                else "inventory"
                if check["code"].startswith("stock:")
                else "delivery"
                if "lead time" in check["message"].lower()
                else "credit"
                if "deposit" in check["message"].lower()
                else "customer"
                if "customer" in check["message"].lower()
                else "duplicate"
                if "duplicate" in check["message"].lower()
                else "operations"
            ),
            "detail": check["message"],
        }
        for check in checks
        if check["level"] in ("warn", "fail")
        and check["code"] not in ("risk", "risk_floor")
    ]

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
        "scoreThresholds": {
            "medium": risk_medium_threshold,
            "high": risk_high_threshold,
            "critical": risk_critical_threshold,
        },
        "riskFactors": risk["factors"],
        "riskTriggers": risk_triggers,
        "responseActions": response_actions,
        "complianceBlocked": compliance_blocked,
        "informationMissing": bool(missing_fields) or confidence < min_confidence,
        "assessmentLayer": (
            "information_missing"
            if missing_fields or confidence < min_confidence
            else "hard_block"
            if compliance_blocked or recommendation == "REJECT"
            else "weighted_review"
            if risk["band"] in ("Medium", "High", "Critical")
            else "low_risk_precheck"
        ),
        "matchedSensitiveTerms": matched_terms,
        "daysUntilDelivery": days_until,
        "missingFields": missing_fields,
        "confidence": confidence,
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
    }
