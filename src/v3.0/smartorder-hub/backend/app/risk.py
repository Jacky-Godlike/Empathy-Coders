"""Explainable order risk score.

The score is a weighted scorecard, not a black box:

* FMEA-style separation of impact and detection (a hard blocker is still a
  blocker; the score ranks the remaining exposure).
* Five factors: stock/capacity, delivery feasibility, margin, data quality and
  order anomaly.
* Weights come from the industry profile, so a service business weighs the
  appointment window differently from a wholesaler weighing payment terms.
* The output includes every factor's raw score, weight and weighted value so a
  reviewer can see why a row is High or Critical.

This is a decision-support score. It never approves an order by itself.
"""

from __future__ import annotations

import math
import re
from datetime import datetime


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

BAND_THRESHOLDS = (
    (75, "Critical"),
    (50, "High"),
    (25, "Medium"),
    (0, "Low"),
)

FACTOR_LABELS = {
    "stock": "Stock / capacity",
    "delivery": "Delivery feasibility",
    "margin": "Margin",
    "data": "Data completeness",
    "anomaly": "Order anomaly",
}


def _band(score: float) -> str:
    for threshold, label in BAND_THRESHOLDS:
        if score >= threshold:
            return label
    return "Low"


def _duplicate(order: dict, history: list[dict] | None) -> bool:
    if not history or not order.get("items"):
        return False
    first_item = order["items"][0]
    if not isinstance(first_item, dict):
        return False
    first_sku = first_item.get("sku")
    try:
        current = datetime.fromisoformat(str(order.get("createdAt", "")))
    except (TypeError, ValueError):
        return False

    for other in history:
        if other.get("id") == order.get("id"):
            continue
        if str(other.get("customerName") or "").lower() != str(
            order.get("customerName") or ""
        ).lower():
            continue
        other_first = (
            other["items"][0] if other.get("items") else None
        )
        if not isinstance(other_first, dict) or other_first.get("sku") != first_sku:
            continue
        try:
            previous = datetime.fromisoformat(str(other.get("createdAt", "")))
        except (TypeError, ValueError):
            continue
        if abs((current - previous).total_seconds()) <= 3 * 86400:
            return True
    return False


def _capacity_blocked(order: dict, industry: dict, products: list[dict]) -> bool:
    if industry.get("id") != "logistics":
        return False

    weight_text = str(order.get("industryFields", {}).get("weightKg") or "")
    match = re.search(r"([\d,]+(?:\.\d+)?)", weight_text)
    if not match:
        return False
    weight = _as_float(match.group(1).replace(",", ""), 0.0)

    catalog = {product["sku"]: product for product in products}
    capacity = 0.0
    for item in order.get("items", []):
        if not isinstance(item, dict) or not isinstance(item.get("sku"), str):
            continue
        product = catalog.get(item.get("sku"))
        if product:
            capacity += _as_float(product.get("capacityKg"), 0.0) * _as_int(
                item.get("quantity"), 0
            )
    return capacity > 0 and weight > capacity


def _no_deposit(order: dict, industry: dict) -> bool:
    return industry.get("id") == "services" and not order.get(
        "industryFields", {}
    ).get("deposit")


def assess_risk(
    *,
    order: dict,
    industry: dict,
    products: list[dict],
    history: list[dict] | None,
    stock: list[dict],
    missing_fields: list[str],
    confidence: float,
    revenue: float,
    margin: float,
    days_until: int | None,
    min_margin: float,
    warn_margin: float,
    high_value_threshold: float,
) -> dict:
    confidence = _as_float(confidence, 0.0)
    revenue = _as_float(revenue, 0.0)
    margin = _as_float(margin, 0.0)
    capacity_blocked = _capacity_blocked(order, industry, products)
    no_deposit = _no_deposit(order, industry)
    duplicate = _duplicate(order, history)
    unknown_customer = (order.get("customerName") or "Unknown") == "Unknown"

    # 1. Data quality.
    data_score = min(
        100.0,
        len(missing_fields) * 32
        + max(0.0, (0.70 - float(confidence or 0)) * 100),
    )

    # 2. Stock or capacity.
    if not stock:
        stock_score = 100.0
        stock_detail = "No catalog line could be checked."
    else:
        short = [line for line in stock if line["shortfall"] > 0]
        late = [line for line in short if not line["canReplenishInTime"]]
        ratio = max(
            (
                line["shortfall"] / max(line["required"], 1)
                for line in short
            ),
            default=0.0,
        )
        stock_score = min(
            100.0,
            ratio * 60
            + (40 if late else 0)
            + (15 if short else 5),
        )
        if capacity_blocked:
            stock_score = max(stock_score, 85.0)
        stock_detail = (
            f"{len(short)} line(s) short; "
            f"{len(late)} cannot be replenished in time."
            if short
            else "All lines are within available stock/capacity."
        )
        if capacity_blocked:
            stock_detail = "Cargo weight exceeds the booked vehicle capacity."

    # 3. Delivery feasibility.
    if days_until is None:
        delivery_score = 75.0
        delivery_detail = "No requested delivery date."
    elif days_until < 0:
        delivery_score = 100.0
        delivery_detail = "Requested date is already in the past."
    else:
        short = [line for line in stock if line["shortfall"] > 0]
        lead = max(
            (line["leadTimeDays"] for line in short),
            default=0,
        )
        buffer_days = 1 if short else 0
        slack = days_until - lead - buffer_days
        if slack < 0:
            delivery_score = 95.0
            delivery_detail = (
                f"Lead time {lead}d + {buffer_days}d buffer exceeds the "
                f"{days_until}d window."
            )
        elif slack == 0:
            delivery_score = 75.0
            delivery_detail = "No slack between lead time and the delivery date."
        elif slack <= 1:
            delivery_score = 55.0
            delivery_detail = f"Only {slack}d of buffer."
        elif slack <= 3:
            delivery_score = 30.0
            delivery_detail = f"{slack}d of buffer."
        else:
            delivery_score = 10.0
            delivery_detail = f"{slack}d of buffer."

    # 4. Margin.
    if margin < 0:
        margin_score = 100.0
        margin_detail = "Selling price is below product cost."
    elif margin < min_margin:
        margin_score = 85.0
        margin_detail = (
            f"Margin {margin:.1%} is below the {min_margin:.0%} minimum."
        )
    elif margin < warn_margin:
        margin_score = 45.0
        margin_detail = (
            f"Margin {margin:.1%} is below the {warn_margin:.0%} comfort line."
        )
    else:
        margin_score = 10.0
        margin_detail = f"Margin {margin:.1%} is healthy."

    # 5. Anomaly / order-specific risk.
    anomaly_score = 5.0
    anomaly_notes: list[str] = []
    if revenue > high_value_threshold:
        anomaly_score += 35
        anomaly_notes.append("high order value")
    if unknown_customer:
        anomaly_score += 25
        anomaly_notes.append("unknown customer")
    if duplicate:
        anomaly_score += 30
        anomaly_notes.append("possible duplicate")
    if no_deposit:
        anomaly_score += 70
        anomaly_notes.append("no deposit for a service booking")
    if capacity_blocked:
        anomaly_score += 50
        anomaly_notes.append("capacity exceeded")
    anomaly_score = min(100.0, anomaly_score)
    anomaly_detail = (
        ", ".join(anomaly_notes) if anomaly_notes else "No anomaly detected."
    )

    scores = {
        "stock": round(stock_score, 1),
        "delivery": round(delivery_score, 1),
        "margin": round(margin_score, 1),
        "data": round(data_score, 1),
        "anomaly": round(anomaly_score, 1),
    }
    details = {
        "stock": stock_detail,
        "delivery": delivery_detail,
        "margin": margin_detail,
        "data": (
            "All required fields are present."
            if not missing_fields
            else f"{len(missing_fields)} field(s) missing."
        ),
        "anomaly": anomaly_detail,
    }

    weights = industry.get("riskWeights", {})
    factors = []
    composite = 0.0
    for key, score in scores.items():
        weight = float(weights.get(key, 0.2))
        weighted = score * weight
        composite += weighted
        factors.append(
            {
                "key": key,
                "label": FACTOR_LABELS[key],
                "score": score,
                "weight": weight,
                "weighted": round(weighted, 1),
                "detail": details[key],
            }
        )

    composite = round(min(100.0, composite), 1)
    warnings = []
    if capacity_blocked:
        warnings.append(
            "Cargo weight exceeds the vehicle capacity; book a larger vehicle."
        )
    if no_deposit:
        warnings.append(
            "No deposit recorded for a service booking; no-show risk is higher."
        )
    if duplicate:
        warnings.append(
            "A similar order from the same customer exists within 3 days."
        )
    if unknown_customer:
        warnings.append("Customer name is unknown; confirm identity before approval.")

    return {
        "score": composite,
        "band": _band(composite),
        "factors": factors,
        "warnings": warnings,
        "capacityBlocked": capacity_blocked,
        "noDeposit": no_deposit,
        "duplicate": duplicate,
    }
