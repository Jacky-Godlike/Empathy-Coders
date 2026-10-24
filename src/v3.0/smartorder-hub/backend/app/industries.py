"""Industry profiles.

Each profile changes four things without touching the core engine:

* the extra fields extracted from a message (and shown in the order table);
* the labels used for the summary/date/stock columns;
* which industry fields are required before an order can be approved;
* the weights used by the risk score.

The field extractor in `extraction.py` reads `label: value` from the message.
That keeps the rule fallback useful across industries; the AI prompt receives
the same field definitions and returns the same keys.
"""

from __future__ import annotations

INDUSTRIES: dict[str, dict] = {
    "fnb": {
        "id": "fnb",
        "name": "F&B / Bakery & Café",
        "tagline": "Perishable goods, pickup windows and delivery dates",
        "businessName": "Kopi Kita Enterprise",
        "inventoryMode": "stock",
        "labels": {
            "summary": "Items",
            "date": "Delivery",
            "stock": "Stock",
            "details": "F&B details",
        },
        "fields": [
            {"key": "orderType", "label": "Order type", "table": True, "required": False},
            {"key": "deliveryWindow", "label": "Window", "table": True, "required": False},
            {"key": "cakeMessage", "label": "Cake message", "table": True, "required": False},
            {"key": "allergens", "label": "Allergens", "table": False, "required": False},
        ],
        "requiredFields": [],
        "riskWeights": {
            "stock": 0.30,
            "delivery": 0.25,
            "margin": 0.20,
            "data": 0.15,
            "anomaly": 0.10,
        },
    },
    "retail": {
        "id": "retail",
        "name": "Retail & E-commerce",
        "tagline": "Variants, couriers and parcel fulfilment",
        "businessName": "The Linen Room",
        "inventoryMode": "stock",
        "labels": {
            "summary": "Items",
            "date": "Ship by",
            "stock": "Stock",
            "details": "Retail details",
        },
        "fields": [
            {"key": "variant", "label": "Variant", "table": True, "required": False},
            {"key": "courier", "label": "Courier", "table": True, "required": False},
            {"key": "paymentStatus", "label": "Payment", "table": True, "required": False},
            {"key": "trackingNumber", "label": "Tracking", "table": False, "required": False},
            {"key": "giftWrap", "label": "Gift wrap", "table": False, "required": False},
        ],
        "requiredFields": [],
        "riskWeights": {
            "stock": 0.30,
            "delivery": 0.20,
            "margin": 0.20,
            "data": 0.15,
            "anomaly": 0.15,
        },
    },
    "wholesale": {
        "id": "wholesale",
        "name": "Wholesale & Distribution",
        "tagline": "PO numbers, payment terms and bulk deliveries",
        "businessName": "Sin Seng Wholesale",
        "inventoryMode": "stock",
        "labels": {
            "summary": "Bulk items",
            "date": "Delivery",
            "stock": "Stock",
            "details": "Wholesale details",
        },
        "fields": [
            {"key": "poNumber", "label": "PO", "table": True, "required": True},
            {"key": "paymentTerms", "label": "Terms", "table": True, "required": False},
            {"key": "deliveryWindow", "label": "Window", "table": True, "required": False},
            {"key": "warehouse", "label": "Warehouse", "table": False, "required": False},
        ],
        "requiredFields": ["poNumber"],
        "riskWeights": {
            "stock": 0.30,
            "delivery": 0.25,
            "margin": 0.15,
            "data": 0.10,
            "anomaly": 0.20,
        },
    },
    "services": {
        "id": "services",
        "name": "Services & Appointments",
        "tagline": "Slots, staff, deposits and no-show risk",
        "businessName": "Glow Studio",
        "inventoryMode": "capacity",
        "labels": {
            "summary": "Services",
            "date": "Appointment",
            "stock": "Slots",
            "details": "Booking details",
        },
        "fields": [
            {"key": "serviceType", "label": "Service", "table": True, "required": False},
            {
                "key": "staff",
                "label": "Staff",
                "table": True,
                "required": False,
                "pattern": r"(?:with|by)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)",
            },
            {"key": "appointmentTime", "label": "Appointment", "table": True, "required": False},
            {"key": "deposit", "label": "Deposit", "table": True, "required": False},
            {"key": "durationMin", "label": "Duration", "table": False, "required": False},
        ],
        "requiredFields": [],
        "riskWeights": {
            "stock": 0.20,
            "delivery": 0.30,
            "margin": 0.15,
            "data": 0.15,
            "anomaly": 0.20,
        },
    },
    "manufacturing": {
        "id": "manufacturing",
        "name": "Manufacturing / Workshop",
        "tagline": "Part numbers, material specs and tolerances",
        "businessName": "Precision Works",
        "inventoryMode": "material",
        "labels": {
            "summary": "Parts",
            "date": "Delivery",
            "stock": "Material",
            "details": "Spec details",
        },
        "fields": [
            {"key": "partNumber", "label": "Part", "table": True, "required": True},
            {"key": "material", "label": "Material", "table": True, "required": True},
            {"key": "tolerance", "label": "Tolerance", "table": True, "required": False},
            {"key": "drawingRev", "label": "Drawing rev", "table": False, "required": False},
            {"key": "qualitySpec", "label": "Quality", "table": False, "required": False},
        ],
        "requiredFields": ["partNumber", "material"],
        "riskWeights": {
            "stock": 0.25,
            "delivery": 0.25,
            "margin": 0.15,
            "data": 0.20,
            "anomaly": 0.15,
        },
    },
    "logistics": {
        "id": "logistics",
        "name": "Logistics & Delivery",
        "tagline": "Routes, cargo weight, vehicles and time windows",
        "businessName": "SwiftMove Logistics",
        "inventoryMode": "capacity",
        "labels": {
            "summary": "Cargo",
            "date": "Window",
            "stock": "Fleet",
            "details": "Route details",
        },
        "fields": [
            {"key": "pickupAddress", "label": "Pickup", "table": True, "required": True},
            {"key": "dropoffAddress", "label": "Dropoff", "table": True, "required": True},
            {
                "key": "weightKg",
                "label": "Weight",
                "table": True,
                "required": True,
                "pattern": (
                    r"(?:weight\s*[:\-]?\s*)?"
                    r"([\d,]+(?:\.\d+)?\s*(?:kg|kgs|kilograms))"
                ),
            },
            {"key": "vehicleType", "label": "Vehicle", "table": True, "required": False},
            {"key": "cargoType", "label": "Cargo", "table": False, "required": False},
            {"key": "volumeM3", "label": "Volume", "table": False, "required": False},
            {"key": "timeWindow", "label": "Time window", "table": False, "required": False},
            {"key": "specialHandling", "label": "Handling", "table": False, "required": False},
        ],
        "requiredFields": ["pickupAddress", "dropoffAddress", "weightKg"],
        "riskWeights": {
            "stock": 0.25,
            "delivery": 0.30,
            "margin": 0.15,
            "data": 0.15,
            "anomaly": 0.15,
        },
    },
}

DEFAULT_INDUSTRY = "fnb"


def list_industries() -> list[dict]:
    return list(INDUSTRIES.values())


def get_industry(industry_id: str | None) -> dict:
    return INDUSTRIES.get(industry_id or DEFAULT_INDUSTRY, INDUSTRIES[DEFAULT_INDUSTRY])


def industry_summary(industry: dict) -> dict:
    """The public shape sent to the frontend (no seed data)."""

    return {
        "id": industry["id"],
        "name": industry["name"],
        "tagline": industry["tagline"],
        "businessName": industry["businessName"],
        "inventoryMode": industry["inventoryMode"],
        "labels": industry["labels"],
        "fields": industry["fields"],
        "requiredFields": industry["requiredFields"],
        "riskWeights": industry["riskWeights"],
    }
