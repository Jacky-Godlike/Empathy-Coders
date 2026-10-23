"""Mock Orbyte integration seam.

SmartOrder Hub is a standalone proof of concept. In a real Orbyte deployment these
five methods would be replaced by Orbyte Connect / Open API calls:

* catalog and inventory come from the shared business hub;
* a purchase draft is written to the procurement module;
* approval is routed through Orbyte's workflow and role model;
* every action is emitted to the shared audit trail.

Keeping the seam explicit makes the product easy to reuse across SMEs without
rewriting the decision engine.
"""

from __future__ import annotations

from datetime import date, timedelta


class MockOrbyteAdapter:
    def __init__(self, data: dict):
        self.data = data

    def get_catalog(self) -> dict:
        return {
            "products": self.data["products"],
            "suppliers": self.data["suppliers"],
            "source": "mock-orbyte-catalog",
        }

    def get_inventory(self, sku: str) -> dict | None:
        product = next(
            (item for item in self.data["products"] if item["sku"] == sku), None
        )
        if not product:
            return None
        return {
            "sku": sku,
            "stock": product["stock"],
            "safetyStock": product["safetyStock"],
        }

    def create_purchase_draft(
        self,
        draft_id: str,
        order_id: str,
        supplier: dict,
        lines: list[dict],
    ) -> dict:
        total = round(
            sum(line["quantity"] * line["unitCost"] for line in lines), 2
        )
        return {
            "id": draft_id,
            "orderId": order_id,
            "supplierId": supplier["id"],
            "supplierName": supplier["name"],
            "items": lines,
            "totalCost": total,
            "expectedDate": (
                date.today()
                + timedelta(days=int(supplier.get("leadTimeDays", 0)))
            ).isoformat(),
            "status": "draft",
            "createdAt": date.today().isoformat(),
            "source": "mock-orbyte-procurement",
        }

    def request_approval(self, order_id: str, role: str) -> dict:
        return {
            "orderId": order_id,
            "requiredRole": role,
            "status": "pending",
            "source": "mock-orbyte-workflow",
        }

    def emit_audit_event(
        self, action: str, entity_id: str, actor: str, details: str
    ) -> dict:
        return {
            "action": action,
            "entityId": entity_id,
            "actor": actor,
            "details": details,
            "source": "mock-orbyte-audit",
        }
