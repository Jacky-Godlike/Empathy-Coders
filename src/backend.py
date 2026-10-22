from datetime import date, datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(
    title="Orbyte Backend A",
    description="SME Order Management and Risk Assessment API",
    version="1.0.0",
)

# 允许前端 Demo 跨域访问。
# 正式部署时应限制为实际前端域名。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------data model-----------

class OrderInput(BaseModel):
    message_id: str
    message_type: str
    customer_name: str | None = None
    product_name: str | None = None
    quantity: int | None = Field(default=None, gt=0)
    unit_price: float | None = Field(default=None, gt=0)
    delivery_address: str | None = None
    requested_delivery_date: date | None = None
    missing_fields: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0, le=1)


class DecisionInput(BaseModel):
    decision: Literal["accept", "reject"]
    note: str = ""


# ---------- simulate business inventory and costs ----------
# stock: current inventory
# cost: procurement cost per item
# lead_time_days: supplier estimated replenishment days

INVENTORY = {
    "coffee beans": {
        "stock": 10,
        "cost": 35.0,
        "lead_time_days": 3,
    },
    "paper cups": {
        "stock": 100,
        "cost": 0.15,
        "lead_time_days": 2,
    },
    "tea leaves": {
        "stock": 30,
        "cost": 20.0,
        "lead_time_days": 4,
    },
}

LOW_PROFIT_MARGIN = 0.10  # 利润率低于 10% 视为利润过低


# ---------- in-memory data ----------


ORDERS: dict[str, dict] = {}
LOGS: dict[str, list[dict]] = {}


def add_log(order_id: str, action: str, details: str):
    LOGS.setdefault(order_id, []).append({
        "action": action,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


def find_order(order_id: str) -> dict:
    order = ORDERS.get(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


# ---------- basic interface ----------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "backend_a",
        "port": 8000,
    }


@app.get("/inventory")
def get_inventory():
    return INVENTORY

# ---------- order management----------

@app.post("/orders", status_code=201)
def create_order(data: OrderInput):
    order_id = f"ORD-{uuid4().hex[:8].upper()}"

    order = data.model_dump(mode="json")
    order.update({
        "order_id": order_id,
        "order_status": "pending",
        "risk_status": None,
        "risk_reason": [],
        "stock": None,
        "unit_cost": None,
        "estimated_profit": None,
        "profit_margin": None,
        "decision_note": "",
    })

    ORDERS[order_id] = order
    LOGS[order_id] = []

    add_log(order_id, "created", "Order created")
    return order


@app.get("/orders")
def list_orders():
    return list(ORDERS.values())


@app.get("/orders/{order_id}")
def get_order(order_id: str):
    return find_order(order_id)


# ---------- order risk analysis ----------


@app.post("/orders/{order_id}/analyze")
def analyze_order(order_id: str):
    order = find_order(order_id)

    if order["order_status"] in ("accepted", "rejected"):
        raise HTTPException(
            status_code=409,
            detail="Finalized orders cannot be re-analyzed",
        )

    reasons = []
    missing = list(order["missing_fields"])

    required_fields = [
        "customer_name",
        "product_name",
        "quantity",
        "unit_price",
        "delivery_address",
        "requested_delivery_date",
    ]

    for field in required_fields:
        if order.get(field) is None or order.get(field) == "":
            if field not in missing:
                missing.append(field)

    if missing:
        status = "信息缺失"
        reasons.append("缺少必要订单信息：" + ", ".join(missing))
        order["stock"] = None
        order["unit_cost"] = None
        order["estimated_profit"] = None
        order["profit_margin"] = None

    else:
        product_key = order["product_name"].strip().lower()
        product = INVENTORY.get(product_key)

        if product is None:
            status = "需采购确认"
            reasons.append("商品不在模拟库存目录中，需要人工核实商品和供应商。")
            order["stock"] = None
            order["unit_cost"] = None
            order["estimated_profit"] = None
            order["profit_margin"] = None

        else:
            stock = product["stock"]
            cost = product["cost"]
            quantity = order["quantity"]
            price = order["unit_price"]

            revenue = quantity * price
            estimated_profit = quantity * (price - cost)
            profit_margin = (
                estimated_profit / revenue if revenue > 0 else 0.0
            )

            order["stock"] = stock
            order["unit_cost"] = cost
            order["estimated_profit"] = round(estimated_profit, 2)
            order["profit_margin"] = round(profit_margin, 4)
            order["lead_time_days"] = product["lead_time_days"]


            if stock < quantity:
                status = "需采购确认"
                reasons.append(
                    f"库存不足：现有 {stock}，订单需要 {quantity}。"
                )

            elif estimated_profit <= 0 or profit_margin < LOW_PROFIT_MARGIN:
                status = "利润过低"
                reasons.append(
                    f"预计利润率为 {profit_margin:.1%}，"
                    f"低于要求的 {LOW_PROFIT_MARGIN:.0%}。"
                )

            else:
                status = "可接单"
                reasons.append("库存充足，预计利润率达到要求。")

    order["missing_fields"] = missing
    order["risk_status"] = status
    order["risk_reason"] = reasons

    add_log(order_id, "analyzed", f"Risk status: {status}")

    return {
        "order_id": order_id,
        "status": status,
        "reasons": reasons,
        "missing_fields": missing,
        "stock": order["stock"],
        "estimated_profit": order["estimated_profit"],
        "profit_margin": order["profit_margin"],
        "lead_time_days": order.get("lead_time_days"),
        "human_approval_required": True,
    }


# ---------- manual approval ----------

@app.post("/orders/{order_id}/decision")
def decide_order(order_id: str, data: DecisionInput):
    order = find_order(order_id)

    if order["order_status"] in ("accepted", "rejected"):
        raise HTTPException(
            status_code=409,
            detail="Order already has a final decision",
        )

    if order["risk_status"] is None:
        raise HTTPException(
            status_code=400,
            detail="Analyze the order before making a decision",
        )

    if data.decision == "accept":
        if order["risk_status"] != "可接单":
            raise HTTPException(
                status_code=400,
                detail=(
                    "This order has a risk that must be resolved "
                    "before acceptance."
                ),
            )

        order["order_status"] = "accepted"
        action = "accepted"

    else:
        order["order_status"] = "rejected"
        action = "rejected"

    order["decision_note"] = data.note

    add_log(
        order_id,
        action,
        data.note or f"Human decision: {data.decision}",
    )

    return {
        "order_id": order_id,
        "order_status": order["order_status"],
        "decision": data.decision,
        "note": data.note,
    }


# ---------- operation log ----------

@app.get("/orders/{order_id}/logs")
def get_order_logs(order_id: str):
    find_order(order_id)
    return LOGS.get(order_id, [])

