"""Synthetic Malaysian SME data.

No real customer, supplier, phone number, address or company appears here.
Dates are generated relative to the day the demo starts so the delivery
windows always make sense.

The inbox intentionally contains a mix of orders, inquiries, ads, after-sales
messages and noise. The intake pipeline classifies all of them; only real
orders reach the review table.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone


def _date_label(d: date) -> str:
    return d.strftime("%d %b")


def _cn_date(d: date) -> str:
    return f"{d.month}月{d.day}日"


def _message(
    message_id: str,
    source: str,
    sender: str,
    contact: str,
    minutes_ago: int,
    text: str,
    now: datetime,
) -> dict:
    return {
        "id": message_id,
        "source": source,
        "sender": sender,
        "contact": contact,
        "timestamp": (now - timedelta(minutes=minutes_ago)).isoformat(),
        "originalText": text,
        "status": "not_analyzed",
        "parsedData": None,
        "reviewNotes": None,
        "errorMessage": None,
        "orderId": None,
    }


def build_fnb_seed() -> dict:
    today = date.today()
    now = datetime.now(timezone.utc)

    suppliers = [
        {
            "id": "SUP-01",
            "name": "Sin Seng Trading",
            "leadTimeDays": 2,
            "moq": 100,
            "contact": "+60 3-7788 1200",
        },
        {
            "id": "SUP-02",
            "name": "Aunty Lim Kuih Supply",
            "leadTimeDays": 1,
            "moq": 20,
            "contact": "+60 12-220 7788",
        },
        {
            "id": "SUP-03",
            "name": "Teh Tarik Brothers",
            "leadTimeDays": 3,
            "moq": 50,
            "contact": "+60 16-555 0199",
        },
    ]

    products = [
        {
            "sku": "KOPI-3IN1",
            "name": "Kopi 3-in-1 Sachet",
            "aliases": [
                "kopi 3-in-1",
                "kopi 3 in 1",
                "3-in-1 kopi",
                "kopi",
                "coffee",
            ],
            "unit": "sachet",
            "sellPrice": 1.20,
            "unitCost": 0.75,
            "stock": 180,
            "safetyStock": 50,
            "supplierId": "SUP-01",
        },
        {
            "sku": "KUIH-LAPIS",
            "name": "Kuih Lapis Box (10 pcs)",
            "aliases": ["kuih lapis", "kuih", "lapis"],
            "unit": "box",
            "sellPrice": 18.00,
            "unitCost": 11.00,
            "stock": 25,
            "safetyStock": 5,
            "supplierId": "SUP-02",
        },
        {
            "sku": "TEH-TARIK",
            "name": "Teh Tarik Sachet",
            "aliases": ["teh tarik", "tea"],
            "unit": "sachet",
            "sellPrice": 1.50,
            "unitCost": 0.90,
            "stock": 90,
            "safetyStock": 30,
            "supplierId": "SUP-03",
        },
        {
            "sku": "NASI-LEMAK",
            "name": "Nasi Lemak Pack",
            "aliases": ["nasi lemak", "nasi"],
            "unit": "pack",
            "sellPrice": 6.50,
            "unitCost": 4.20,
            "stock": 40,
            "safetyStock": 10,
            "supplierId": "SUP-02",
        },
        {
            "sku": "KAYA-TOAST",
            "name": "Kaya Toast Set",
            "aliases": ["kaya toast", "toast"],
            "unit": "set",
            "sellPrice": 8.50,
            "unitCost": 5.00,
            "stock": 60,
            "safetyStock": 10,
            "supplierId": "SUP-02",
        },
        {
            "sku": "PANDAN-CAKE",
            "name": "Pandan Chiffon Cake",
            "aliases": ["pandan cake", "pandan chiffon", "chiffon cake", "cake"],
            "unit": "cake",
            "sellPrice": 22.00,
            "unitCost": 13.00,
            "stock": 12,
            "safetyStock": 2,
            "supplierId": "SUP-02",
        },
        {
            "sku": "CURRY-PUFF",
            "name": "Curry Puff (10 pcs)",
            "aliases": ["curry puff", "curry puffs", "puff"],
            "unit": "box",
            "sellPrice": 12.00,
            "unitCost": 7.00,
            "stock": 40,
            "safetyStock": 8,
            "supplierId": "SUP-02",
        },
        {
            "sku": "SAMBAL-JAR",
            "name": "Sambal Chilli Jar",
            "aliases": ["sambal jar", "sambal", "chilli sauce"],
            "unit": "jar",
            "sellPrice": 9.50,
            "unitCost": 5.50,
            "stock": 30,
            "safetyStock": 8,
            "supplierId": "SUP-01",
        },
    ]

    d1 = today + timedelta(days=4)   # main order
    d2 = today + timedelta(days=1)   # urgent
    d3 = today + timedelta(days=3)
    d4 = today + timedelta(days=5)   # low margin
    d5 = today + timedelta(days=2)
    d6 = today + timedelta(days=6)
    d7 = today + timedelta(days=4)
    d8 = today + timedelta(days=3)
    d9 = today + timedelta(days=6)

    raw = [
        # 1 — main demo: shortfall but supplier can deliver in time
        (
            "whatsapp", "Aisyah Rahman", "+60 12-345 6789", 12,
            "Hi Kak, ini Aisyah Rahman. Nak order 240 sachet kopi 3-in-1 "
            f"dan 30 kotak kuih lapis. Hantar ke 12, Jalan SS2/24, "
            f"Petaling Jaya pada {_date_label(d1)} sebelum 3pm. "
            "Window: before 3pm. Boleh?",
        ),
        # 2 — urgent: cannot meet the delivery date
        (
            "email", "Daniel Tan", "daniel@kedaikita.example", 45,
            "Hi, this is Daniel Tan from Kedai Kita. We need 500 sachets "
            "of kopi 3-in-1 delivered to 88 Jalan Ampang, Kuala Lumpur "
            f"by {_date_label(d2)} 10am. Urgent, please confirm.",
        ),
        # 3 — order but no address
        (
            "whatsapp", "Mr Lee", "+60 16-222 3344", 90,
            "Hi, ini Mr Lee. Order 12 nasi lemak and 20 kaya toast for "
            "delivery this Friday 8am. Please confirm.",
        ),
        # 4 — low margin
        (
            "whatsapp", "Kak Mimi", "+60 13-777 2020", 135,
            "Can you do 100 sachet teh tarik at RM1.00 each? "
            f"Hantar ke 5 Jalan Gasing, Petaling Jaya pada {_date_label(d4)}. "
            "Thanks.",
        ),
        # 5 — high value, two suppliers
        (
            "email", "Sarah Lim", "sarah@officepantry.example", 180,
            "Hi, ini Sarah Lim from Office Pantry. Please deliver 200 nasi "
            "lemak and 100 kaya toast to 1 Jalan SS15/4, Subang Jaya on "
            f"{_date_label(d3)} before 12pm. Window: 11:30am-12pm. "
            "Purchase order attached.",
        ),
        # 6 — Chinese order
        (
            "whatsapp", "陈小姐", "+60 12-888 6677", 225,
            "你好，我要订 60 包 kopi 3-in-1 和 20 盒 kuih lapis。"
            f"送到 18 Jalan Gasing, Petaling Jaya. {_cn_date(d5)} 下午3点前。谢谢。",
        ),
        # 7 — Malay order
        (
            "whatsapp", "Nurul", "+60 11-2233 4455", 270,
            "Salam, saya nak order 50 sachet teh tarik dan 15 kotak kuih "
            f"lapis. Hantar ke 7, Jalan SS15/4, Subang Jaya pada "
            f"{_date_label(d5)} sebelum 12pm. Terima kasih.",
        ),
        # 8 — corporate email, multiple items
        (
            "email", "Hafiz", "hafiz@menaraabc.example", 315,
            "Dear Kopi Kita, Please supply 40 boxes of kuih lapis and 50 "
            f"sachets of teh tarik for our office event on {_date_label(d6)}. "
            "Deliver to Level 12, Menara ABC, Jalan Ampang, Kuala Lumpur. "
            "Window: 11am-12pm. Regards, Hafiz.",
        ),
        # 9 — pickup, no address required
        (
            "whatsapp", "Aina", "+60 17-666 8899", 360,
            "Hi, nak order 30 curry puff and 10 pandan cake for pick up "
            "this Saturday 11am. Nama saya Aina. "
            "Cake message: Happy Birthday Aina. Allergens: nuts.",
        ),
        # 10 — small order
        (
            "whatsapp", "Ravi", "+60 12-444 5566", 405,
            "Hi, can I order 6 kaya toast and 6 nasi lemak for delivery to "
            "22 Jalan Gasing, PJ tomorrow 9am?",
        ),
        # 11 — new product, tiny shortfall
        (
            "whatsapp", "Mei Ling", "+60 18-777 9900", 450,
            "Please send 24 sambal jars to 9 Jalan SS2/75, PJ on "
            f"{_date_label(d7)}. Thanks, Mei Ling.",
        ),
        # 12 — order but no date
        (
            "whatsapp", "Kumar", "+60 16-333 2211", 495,
            "Hi, I'd like to order 50 kopi 3-in-1 and 10 kuih lapis. "
            "Deliver to 3 Jalan Universiti, PJ. Thanks, Kumar.",
        ),
        # 13 — urgent, large
        (
            "email", "Nadia", "nadia@cafe.example", 540,
            "Hi Kopi Kita, we need 300 sachets of kopi 3-in-1 and 50 boxes "
            "of kuih lapis delivered to 15 Jalan SS2/24, PJ by "
            f"{_date_label(d2)}. Please confirm urgently.",
        ),
        # 14 — pickup today
        (
            "whatsapp", "Ahmad", "+60 19-111 2233", 585,
            "Salam, nak order 20 nasi lemak dan 20 kaya toast untuk pickup "
            "hari ini 6pm. Hantar ke kedai.",
        ),
        # 15 — inquiry
        (
            "whatsapp", "Farah", "+60 19-888 1234", 630,
            "Hi, do you have teh tarik in stock? Just asking, no order yet.",
        ),
        # 16 — inquiry
        (
            "whatsapp", "Siti", "+60 13-222 4455", 675,
            "Hi, do you have pandan cake in stock? How much?",
        ),
        # 17 — inquiry
        (
            "whatsapp", "Ben", "+60 12-999 0011", 720,
            "Can you deliver to Cyberjaya? What is your minimum order?",
        ),
        # 18 — Malay inquiry
        (
            "whatsapp", "Lin", "+60 16-555 7788", 765,
            "Berapa harga kuih lapis? Boleh hantar ke KL?",
        ),
        # 19 — ad
        (
            "whatsapp", "Unknown", "+60 11-000 1111", 810,
            "🔥 PROMO 50% OFF! Buy 1 free 1 coffee beans. "
            "Click here: bit.ly/xyz. Unsubscribe.",
        ),
        # 20 — supplier ad
        (
            "email", "Packaging Co", "packaging@example.com", 855,
            "We are a trusted supplier of packaging materials. We can offer "
            "you wholesale prices. Reply for our catalogue.",
        ),
        # 21 — ad
        (
            "whatsapp", "Unknown", "+60 12-777 0000", 900,
            "Grow your business with our SEO services! First month free. "
            "Call 03-1234 5678.",
        ),
        # 22 — ad / scam
        (
            "whatsapp", "Unknown", "+60 16-000 2222", 945,
            "Loan approved! RM50,000 fast approval, no collateral. "
            "WhatsApp us now.",
        ),
        # 23 — after-sales
        (
            "whatsapp", "Puan Ros", "+60 12-333 4444", 990,
            "I want a refund for the damaged kopi 3-in-1 delivered yesterday.",
        ),
        # 24 — after-sales
        (
            "whatsapp", "Hafiz", "+60 17-888 1122", 1035,
            "My order hasn't arrived. Please help.",
        ),
        # 25 — after-sales
        (
            "email", "Jin", "jin@example.com", 1080,
            "Wrong item received: I ordered kuih lapis but got kaya toast.",
        ),
        # 26 — after-sales
        (
            "whatsapp", "Aina", "+60 17-666 8899", 1125,
            "The curry puffs were broken. Can I get a replacement?",
        ),
        # 27 — other
        (
            "whatsapp", "Boss", "+60 12-000 3333", 1170,
            "Meeting postponed to Friday. See you at 3pm.",
        ),
        # 28 — other
        (
            "whatsapp", "Unknown", "+60 11-222 3333", 1215,
            "Hi, is this Kopi Kita? I'm looking for a different shop.",
        ),
        # 29 — feedback
        (
            "whatsapp", "Mei", "+60 18-777 9900", 1260,
            "Thank you so much! The kuih was delicious.",
        ),
        # 30 — other
        (
            "whatsapp", "Unknown", "+60 11-444 5555", 1305,
            "Hello, good morning.",
        ),
        # 31 — uncertain
        (
            "whatsapp", "Unknown", "+60 11-555 6666", 1350,
            "???",
        ),
        # 32 — ambiguous, no quantities
        (
            "whatsapp", "Aisyah Rahman", "+60 12-345 6789", 1395,
            "Hi, can I order some kopi and kuih for this weekend?",
        ),
        # 33 — unknown product
        (
            "email", "Procurement", "procurement@example.com", 1440,
            "Can I order 20 boxes of chocolate brownies to 5 Jalan Gasing, "
            f"PJ on {_date_label(d8)}?",
        ),
        # 34 — order with missing address and date
        (
            "whatsapp", "Raj", "+60 12-888 9999", 1485,
            "Hi, order 10 kopi 3-in-1 for delivery.",
        ),
    ]

    messages = [
        _message(f"MSG-{index:04d}", source, sender, contact, minutes, text, now)
        for index, (source, sender, contact, minutes, text) in enumerate(raw, start=1)
    ]

    return {
        "suppliers": suppliers,
        "products": products,
        "messages": messages,
        "orders": [],
        "activity": [],
        "meta": {
            "businessName": "Kopi Kita Enterprise",
            "industry": "fnb",
            "currency": "MYR",
            "seededAt": now.isoformat(),
        },
    }


def build_seed(industry: str = "fnb") -> dict:
    """Return the synthetic dataset for an industry."""

    if industry == "fnb":
        return build_fnb_seed()

    from .industry_seed import build_industry_seed

    return build_industry_seed(industry)
