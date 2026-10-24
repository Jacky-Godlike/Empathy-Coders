"""Synthetic datasets for the non-F&B industry profiles.

Each dataset follows the same shape as the F&B seed: suppliers, products,
messages and an empty order/activity log. The messages intentionally include
orders, inquiries, ads, after-sales and noise so the intake classifier has
something to filter.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from .seed import _message


def _d(today: date, days: int) -> str:
    return (today + timedelta(days=days)).strftime("%d %b")


def _pack(
    industry: str,
    business: str,
    suppliers: list[dict],
    products: list[dict],
    raw: list[tuple],
    now: datetime,
) -> dict:
    messages = [
        _message(
            f"MSG-{index:04d}",
            source,
            sender,
            contact,
            minutes,
            text,
            now,
        )
        for index, (source, sender, contact, minutes, text) in enumerate(raw, start=1)
    ]
    return {
        "suppliers": suppliers,
        "products": products,
        "messages": messages,
        "orders": [],
        "activity": [],
        "meta": {
            "businessName": business,
            "industry": industry,
            "currency": "MYR",
            "seededAt": now.isoformat(),
        },
    }


def _retail(today: date, now: datetime) -> dict:
    suppliers = [
        {
            "id": "SUP-R1",
            "name": "Linen & Co",
            "leadTimeDays": 3,
            "moq": 10,
            "contact": "+60 3-7788 3300",
        },
        {
            "id": "SUP-R2",
            "name": "Urban Living Supplies",
            "leadTimeDays": 5,
            "moq": 20,
            "contact": "+60 12-220 9911",
        },
    ]
    products = [
        {
            "sku": "SHIRT-OVERSIZED",
            "name": "Oversized Linen Shirt",
            "aliases": ["oversized linen shirt", "linen shirt", "shirt"],
            "unit": "pc",
            "sellPrice": 129.0,
            "unitCost": 62.0,
            "stock": 24,
            "safetyStock": 6,
            "supplierId": "SUP-R1",
        },
        {
            "sku": "TOTE-CANVAS",
            "name": "Canvas Tote Bag",
            "aliases": ["canvas tote bag", "canvas tote", "tote bag", "tote"],
            "unit": "pc",
            "sellPrice": 59.0,
            "unitCost": 21.0,
            "stock": 80,
            "safetyStock": 20,
            "supplierId": "SUP-R1",
        },
        {
            "sku": "MUG-CERAMIC",
            "name": "Ceramic Mug",
            "aliases": ["ceramic mug", "mug"],
            "unit": "pc",
            "sellPrice": 39.0,
            "unitCost": 14.0,
            "stock": 60,
            "safetyStock": 15,
            "supplierId": "SUP-R2",
        },
        {
            "sku": "LAMP-DESK",
            "name": "Desk Lamp",
            "aliases": ["desk lamp", "lamp"],
            "unit": "pc",
            "sellPrice": 159.0,
            "unitCost": 88.0,
            "stock": 10,
            "safetyStock": 3,
            "supplierId": "SUP-R2",
        },
        {
            "sku": "NOTEBOOK-SET",
            "name": "Notebook Set",
            "aliases": ["notebook set", "notebook"],
            "unit": "set",
            "sellPrice": 45.0,
            "unitCost": 18.0,
            "stock": 35,
            "safetyStock": 10,
            "supplierId": "SUP-R2",
        },
    ]
    raw = [
        (
            "whatsapp", "Hannah Lee", "+60 12-345 9001", 20,
            "Hi, I'd like to order 2 Oversized Linen Shirt. Variant: M / Sand. "
            f"Ship to 12 Jalan SS2/24, PJ by {_d(today, 4)}. Courier: J&T. Payment: paid.",
        ),
        (
            "email", "Event Team", "events@example.com", 65,
            "Order 20 Canvas Tote Bag. Variant: Natural. Deliver to 8 Jalan Gasing, "
            f"PJ on {_d(today, 6)}. Courier: Ninja Van. Payment: pending.",
        ),
        (
            "whatsapp", "Aina", "+60 17-666 1200", 110,
            "Need 12 Ceramic Mug. Variant: White. Ship to 5 Jalan Universiti, PJ by "
            f"{_d(today, 2)}. Courier: Pos Laju. Payment: COD.",
        ),
        (
            "whatsapp", "Daniel", "+60 16-333 7788", 155,
            "Order 3 Desk Lamp. Variant: Black. Deliver to 22 Jalan Gasing, PJ on "
            f"{_d(today, 8)}. Courier: DHL. Payment: paid.",
        ),
        (
            "email", "Mei Ling", "mei@example.com", 200,
            "Hi, can I order 10 Notebook Set? Ship to 3 Jalan Universiti, PJ. No date yet.",
        ),
        (
            "whatsapp", "Ravi", "+60 12-444 5511", 245,
            "Need 30 Desk Lamp at RM80 each by tomorrow. Deliver to 9 Jalan SS2/75, "
            "PJ. Courier: J&T.",
        ),
        (
            "whatsapp", "Sofia", "+60 13-222 8899", 290,
            "Do you have the linen shirt in size L? How much?",
        ),
        (
            "email", "Home Store", "promo@example.com", 335,
            "MEGA SALE 50% off all homeware! Use code HOME50. Unsubscribe.",
        ),
        (
            "whatsapp", "Nadia", "+60 18-777 2211", 380,
            "My ceramic mug arrived broken. I want a refund.",
        ),
        (
            "whatsapp", "Unknown", "+60 11-900 2211", 425,
            "Hello, is this The Linen Room?",
        ),
    ]
    return _pack("retail", "The Linen Room", suppliers, products, raw, now)


def _wholesale(today: date, now: datetime) -> dict:
    suppliers = [
        {
            "id": "SUP-W1",
            "name": "Bulk Foods Trading",
            "leadTimeDays": 3,
            "moq": 20,
            "contact": "+60 3-5566 7788",
        },
        {
            "id": "SUP-W2",
            "name": "Pantry Distributors",
            "leadTimeDays": 5,
            "moq": 50,
            "contact": "+60 12-888 3300",
        },
    ]
    products = [
        {
            "sku": "RICE-10KG",
            "name": "Rice 10kg",
            "aliases": ["rice 10kg", "rice"],
            "unit": "bag",
            "sellPrice": 38.0,
            "unitCost": 31.0,
            "stock": 200,
            "safetyStock": 40,
            "supplierId": "SUP-W1",
        },
        {
            "sku": "OIL-5L",
            "name": "Cooking Oil 5L",
            "aliases": ["cooking oil 5l", "cooking oil", "oil 5l"],
            "unit": "bottle",
            "sellPrice": 32.0,
            "unitCost": 26.0,
            "stock": 150,
            "safetyStock": 30,
            "supplierId": "SUP-W1",
        },
        {
            "sku": "SUGAR-1KG",
            "name": "Sugar 1kg",
            "aliases": ["sugar 1kg", "sugar"],
            "unit": "pack",
            "sellPrice": 4.2,
            "unitCost": 3.4,
            "stock": 500,
            "safetyStock": 100,
            "supplierId": "SUP-W2",
        },
        {
            "sku": "FLOUR-25KG",
            "name": "Flour 25kg",
            "aliases": ["flour 25kg", "flour"],
            "unit": "bag",
            "sellPrice": 62.0,
            "unitCost": 52.0,
            "stock": 80,
            "safetyStock": 20,
            "supplierId": "SUP-W2",
        },
    ]
    raw = [
        (
            "email", "Sunway Catering", "orders@sunwaycatering.example", 30,
            "Hi, please supply 100 Rice 10kg and 50 Cooking Oil 5L. PO: PO-8821. "
            f"Terms: 30 days. Deliver to 15 Jalan SS15/4, Subang Jaya on {_d(today, 5)}. "
            "Window: 9am-12pm.",
        ),
        (
            "whatsapp", "Kedai Pak Su", "+60 19-774 2201", 75,
            "Order 200 Sugar 1kg and 40 Flour 25kg. PO: PO-8822. Terms: 14 days. "
            f"Deliver to 8 Jalan Ampang, KL on {_d(today, 6)}.",
        ),
        (
            "email", "Cafe Lima", "cafe@lima.example", 120,
            "Need 300 Rice 10kg by tomorrow. PO: PO-8823. Terms: COD. "
            "Deliver to 1 Jalan Gasing, PJ.",
        ),
        (
            "whatsapp", "Restoran Nasi Lemak", "+60 12-333 5500", 165,
            "Please supply 60 Flour 25kg. PO: PO-8824. Terms: 30 days. "
            f"Deliver to 5 Jalan Universiti, PJ on {_d(today, 9)}.",
        ),
        (
            "email", "Bistro 88", "bistro88@example.com", 210,
            "Order 100 Cooking Oil 5L. PO: PO-8825. Deliver to 9 Jalan SS2/75, PJ. "
            "No date.",
        ),
        (
            "whatsapp", "Kedai Hijau", "+60 13-401 7788", 255,
            "Can you do 100 Rice 10kg at RM30 each? PO: PO-8826. Terms: 30 days. "
            f"Deliver to 3 Jalan Gasing, PJ on {_d(today, 5)}.",
        ),
        (
            "whatsapp", "New Cafe", "+60 17-222 3344", 300,
            "What is your price for 500 Sugar 1kg? Do you offer credit terms?",
        ),
        (
            "email", "Supplier Promo", "promo@supplier.example", 345,
            "Wholesale promotion: 10% off all cooking oil this month. Reply for catalogue.",
        ),
        (
            "whatsapp", "Puan Ros", "+60 12-333 4444", 390,
            "The last rice delivery was damaged. I want a replacement.",
        ),
        (
            "whatsapp", "Boss", "+60 12-000 3333", 435,
            "Meeting with the warehouse team moved to Friday.",
        ),
    ]
    return _pack("wholesale", "Sin Seng Wholesale", suppliers, products, raw, now)


def _services(today: date, now: datetime) -> dict:
    suppliers = [
        {
            "id": "SUP-S1",
            "name": "Glow Studio Team",
            "leadTimeDays": 0,
            "moq": 1,
            "contact": "+60 3-7788 5500",
        }
    ]
    products = [
        {
            "sku": "HAIRCUT",
            "name": "Signature Haircut",
            "aliases": ["signature haircut", "haircut"],
            "unit": "slot",
            "sellPrice": 60.0,
            "unitCost": 20.0,
            "stock": 8,
            "safetyStock": 1,
            "supplierId": "SUP-S1",
        },
        {
            "sku": "FACIAL",
            "name": "Glow Facial",
            "aliases": ["glow facial", "facial"],
            "unit": "slot",
            "sellPrice": 120.0,
            "unitCost": 45.0,
            "stock": 6,
            "safetyStock": 1,
            "supplierId": "SUP-S1",
        },
        {
            "sku": "MASSAGE",
            "name": "Relaxing Massage",
            "aliases": ["relaxing massage", "massage"],
            "unit": "slot",
            "sellPrice": 150.0,
            "unitCost": 55.0,
            "stock": 5,
            "safetyStock": 1,
            "supplierId": "SUP-S1",
        },
        {
            "sku": "MANICURE",
            "name": "Classic Manicure",
            "aliases": ["classic manicure", "manicure"],
            "unit": "slot",
            "sellPrice": 45.0,
            "unitCost": 15.0,
            "stock": 10,
            "safetyStock": 2,
            "supplierId": "SUP-S1",
        },
    ]
    raw = [
        (
            "whatsapp", "Hannah", "+60 12-345 9001", 20,
            "Hi, I'd like to book a Glow Facial on "
            f"{_d(today, 4)} at 3pm with Aina. Duration: 60 min. Deposit: RM50. "
            "Location: Glow Studio, SS2.",
        ),
        (
            "whatsapp", "Sofia", "+60 13-222 8899", 65,
            "Can I book 2 Relaxing Massage on "
            f"{_d(today, 5)} at 5pm with Siti? Deposit: RM100.",
        ),
        (
            "whatsapp", "Daniel", "+60 16-333 7788", 110,
            "Book 1 Signature Haircut on "
            f"{_d(today, 2)} at 11am with Ben. Deposit: RM20.",
        ),
        (
            "email", "Bridal Party", "bridal@example.com", 155,
            "Need 6 Classic Manicure for a bridal party on "
            f"{_d(today, 7)} at 10am. Deposit: RM100. Staff: Mei.",
        ),
        (
            "whatsapp", "Aisyah", "+60 12-345 6789", 200,
            "Hi, can I book a facial this weekend? No date confirmed.",
        ),
        (
            "whatsapp", "Ravi", "+60 12-444 5511", 245,
            "Book 4 Relaxing Massage on "
            f"{_d(today, 1)} at 2pm with Siti. No deposit.",
        ),
        (
            "whatsapp", "Mei", "+60 18-777 2211", 290,
            "How much is the massage? Do you have a slot on Friday?",
        ),
        (
            "email", "Salon Promo", "promo@salon.example", 335,
            "New salon promotion: 30% off first facial. Book now!",
        ),
        (
            "whatsapp", "Nadia", "+60 18-777 2211", 380,
            "I was charged twice for my manicure. Please refund.",
        ),
        (
            "whatsapp", "Unknown", "+60 11-900 2211", 425,
            "Hello, is this Glow Studio? I'm looking for a different salon.",
        ),
    ]
    return _pack("services", "Glow Studio", suppliers, products, raw, now)


def _manufacturing(today: date, now: datetime) -> dict:
    suppliers = [
        {
            "id": "SUP-M1",
            "name": "MetalWorks Supply",
            "leadTimeDays": 4,
            "moq": 20,
            "contact": "+60 3-7788 2200",
        },
        {
            "id": "SUP-M2",
            "name": "Precision Components",
            "leadTimeDays": 7,
            "moq": 10,
            "contact": "+60 12-220 7788",
        },
    ]
    products = [
        {
            "sku": "BRACKET-ALU",
            "name": "Aluminium Bracket",
            "aliases": ["aluminium bracket", "bracket"],
            "unit": "pc",
            "sellPrice": 18.0,
            "unitCost": 11.0,
            "stock": 120,
            "safetyStock": 20,
            "supplierId": "SUP-M1",
        },
        {
            "sku": "PLATE-STEEL",
            "name": "Steel Plate 2mm",
            "aliases": ["steel plate 2mm", "steel plate", "plate"],
            "unit": "pc",
            "sellPrice": 45.0,
            "unitCost": 32.0,
            "stock": 40,
            "safetyStock": 10,
            "supplierId": "SUP-M1",
        },
        {
            "sku": "GEAR-CUSTOM",
            "name": "Custom Gear",
            "aliases": ["custom gear", "gear"],
            "unit": "pc",
            "sellPrice": 120.0,
            "unitCost": 78.0,
            "stock": 15,
            "safetyStock": 3,
            "supplierId": "SUP-M2",
        },
        {
            "sku": "PANEL-ACRYLIC",
            "name": "Acrylic Panel",
            "aliases": ["acrylic panel", "panel"],
            "unit": "pc",
            "sellPrice": 85.0,
            "unitCost": 55.0,
            "stock": 25,
            "safetyStock": 5,
            "supplierId": "SUP-M2",
        },
    ]
    raw = [
        (
            "email", "BrightWorks", "purchase@brightworks.example", 25,
            "Please manufacture 50 Aluminium Bracket. Part: BRK-104. Material: "
            f"Aluminium 6061. Tolerance: +/-0.5mm. Drawing rev: C. Deliver to "
            f"12 Jalan Industri, PJ on {_d(today, 8)}. PO: PO-7710.",
        ),
        (
            "email", "AutoParts Sdn Bhd", "buyer@autoparts.example", 70,
            "Order 20 Custom Gear. Part: GR-220. Material: Steel. Tolerance: "
            f"+/-0.1mm. Drawing rev: B. Deliver to 8 Jalan Ampang, KL on "
            f"{_d(today, 11)}. PO: PO-7711.",
        ),
        (
            "whatsapp", "Site Manager", "+60 12-333 5500", 115,
            "Need 100 Steel Plate 2mm by tomorrow. Part: SP-2MM. Material: Mild "
            "Steel. Deliver to 5 Jalan Gasing, PJ. PO: PO-7712.",
        ),
        (
            "email", "Design Lab", "design@example.com", 160,
            "Order 10 Acrylic Panel. Part: AP-300. Material: Acrylic. Tolerance: "
            f"+/-1mm. Deliver to 3 Jalan Universiti, PJ on {_d(today, 7)}. "
            "PO: PO-7713.",
        ),
        (
            "whatsapp", "Engineer Tan", "+60 16-222 3344", 205,
            "Please quote 200 Aluminium Bracket. Part: BRK-104. No date.",
        ),
        (
            "whatsapp", "Kedai Hijau", "+60 13-401 7788", 250,
            "Can you do 100 Steel Plate 2mm at RM28 each? Part: SP-2MM. "
            f"Material: Mild Steel. Deliver to 3 Jalan Gasing, PJ on "
            f"{_d(today, 6)}. PO: PO-7714.",
        ),
        (
            "email", "R&D Team", "rd@example.com", 295,
            "Can you make a custom gear with 40 teeth? What is the lead time?",
        ),
        (
            "email", "Machine Tools", "promo@machinetools.example", 340,
            "CNC machine promotion: 20% off machine time this month. Reply for quote.",
        ),
        (
            "whatsapp", "QA Lead", "+60 12-777 0000", 385,
            "The last batch of brackets was out of tolerance. I need a replacement.",
        ),
        (
            "whatsapp", "Boss", "+60 12-000 3333", 430,
            "Meeting with the production team moved to Friday.",
        ),
    ]
    return _pack("manufacturing", "Precision Works", suppliers, products, raw, now)


def _logistics(today: date, now: datetime) -> dict:
    suppliers = [
        {
            "id": "SUP-L1",
            "name": "Fleet Partners",
            "leadTimeDays": 1,
            "moq": 1,
            "contact": "+60 3-7788 6600",
        },
        {
            "id": "SUP-L2",
            "name": "ColdChain Fleet",
            "leadTimeDays": 2,
            "moq": 1,
            "contact": "+60 12-220 5566",
        },
    ]
    products = [
        {
            "sku": "VAN-1T",
            "name": "1-Tonne Van",
            "aliases": ["1-tonne van", "1 tonne van", "van"],
            "unit": "trip",
            "sellPrice": 180.0,
            "unitCost": 110.0,
            "stock": 4,
            "safetyStock": 1,
            "supplierId": "SUP-L1",
            "capacityKg": 1000,
        },
        {
            "sku": "LORRY-3T",
            "name": "3-Tonne Lorry",
            "aliases": ["3-tonne lorry", "3 tonne lorry", "lorry"],
            "unit": "trip",
            "sellPrice": 420.0,
            "unitCost": 280.0,
            "stock": 3,
            "safetyStock": 1,
            "supplierId": "SUP-L1",
            "capacityKg": 3000,
        },
        {
            "sku": "COLD-1T",
            "name": "Cold Chain Van",
            "aliases": ["cold chain van", "cold van"],
            "unit": "trip",
            "sellPrice": 350.0,
            "unitCost": 240.0,
            "stock": 2,
            "safetyStock": 1,
            "supplierId": "SUP-L2",
            "capacityKg": 1000,
        },
        {
            "sku": "LORRY-10T",
            "name": "10-Tonne Lorry",
            "aliases": ["10-tonne lorry", "10 tonne lorry", "10 ton lorry"],
            "unit": "trip",
            "sellPrice": 900.0,
            "unitCost": 650.0,
            "stock": 1,
            "safetyStock": 0,
            "supplierId": "SUP-L2",
            "capacityKg": 10000,
        },
    ]
    raw = [
        (
            "whatsapp", "Hannah", "+60 12-345 9001", 20,
            "Need a 1-tonne van for a move. Pickup: 12 Jalan SS2/24, PJ. Dropoff: "
            f"8 Jalan Ampang, KL. Cargo: 20 boxes. Weight: 450kg. Vehicle: 1-tonne "
            f"van. Window: 9am-12pm on {_d(today, 4)}. Handling: fragile.",
        ),
        (
            "email", "Office Move", "ops@example.com", 65,
            "Book 2 3-tonne lorry. Pickup: 15 Jalan Industri, PJ. Dropoff: 1 Jalan "
            f"Universiti, PJ. Cargo: furniture. Weight: 2500kg. Vehicle: 3-tonne "
            f"lorry. Window: 2pm-6pm on {_d(today, 5)}.",
        ),
        (
            "whatsapp", "Frozen Foods", "+60 12-333 5500", 110,
            "Need a cold chain van tomorrow for 12 boxes of frozen food, weight "
            "800kg. Pickup: 5 Jalan Gasing, PJ. Dropoff: 9 Jalan SS2/75, PJ. "
            "Window: 8am-11am. Vehicle: cold chain van.",
        ),
        (
            "email", "Steel Works", "logistics@steelworks.example", 155,
            "Need a 10-tonne lorry on "
            f"{_d(today, 6)} for 12,000kg of steel. Pickup: 3 Jalan Industri, PJ. "
            "Dropoff: 8 Jalan Ampang, KL. Vehicle: 10-tonne lorry.",
        ),
        (
            "whatsapp", "Kedai Hijau", "+60 13-401 7788", 200,
            f"Need a van on {_d(today, 7)}. Pickup: 5 Jalan Gasing, PJ. "
            "Dropoff: 3 Jalan Universiti, PJ. Cargo: 10 boxes. "
            "Vehicle: 1-tonne van.",
        ),
        (
            "whatsapp", "Bulk Movers", "+60 12-444 5511", 245,
            "Need a 10-tonne lorry for RM700 on "
            f"{_d(today, 8)}. Pickup: 3 Jalan Industri, PJ. Dropoff: 8 Jalan "
            "Ampang, KL. Weight: 9000kg.",
        ),
        (
            "whatsapp", "Cafe Lima", "+60 12-555 8899", 290,
            "Do you have a 3-tonne lorry available this Friday? What is the rate?",
        ),
        (
            "email", "Fleet Promo", "promo@fleet.example", 335,
            "Fleet sale: 15% off annual maintenance contracts. Call us.",
        ),
        (
            "whatsapp", "Puan Ros", "+60 12-333 4444", 380,
            "The driver arrived late and the cargo was damaged. I want a refund.",
        ),
        (
            "whatsapp", "Boss", "+60 12-000 3333", 425,
            "Meeting with the fleet team moved to Friday.",
        ),
    ]
    return _pack("logistics", "SwiftMove Logistics", suppliers, products, raw, now)


def build_industry_seed(industry: str) -> dict:
    today = date.today()
    now = datetime.now(timezone.utc)

    builders = {
        "retail": _retail,
        "wholesale": _wholesale,
        "services": _services,
        "manufacturing": _manufacturing,
        "logistics": _logistics,
    }
    builder = builders.get(industry)
    if not builder:
        from .seed import build_fnb_seed

        return build_fnb_seed()
    return builder(today, now)
