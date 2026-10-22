from datetime import date
from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator

class MessageType(str, Enum):
    order = "order"
    inquiry = "inquiry"
    after_sales = "after_sales"
    other = "other"
    uncertain = "uncertain"

class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=5000)
    source: Literal["whatsapp", "email", "manual"] = "manual"
    message_id: str | None = Field(default=None, max_length=100)
    @field_validator("message")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("message cannot be blank")
        return value

class AnalyzeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message_id: str | None = None
    message_type: MessageType
    customer_name: str | None = None
    customer_phone: str | None = None
    product_name: str | None = None
    quantity: int | None = Field(default=None, gt=0, strict=True)
    unit_price: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    delivery_address: str | None = None
    requested_delivery_date: date | None = None
    missing_fields: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1, allow_inf_nan=False)
    extraction_method: Literal["ai", "fallback"]

class MessageRecord(BaseModel):
    message_id: str
    source: Literal["whatsapp", "email"]
    message: str

class MessagesResponse(BaseModel):
    messages: list[MessageRecord]
    total: int

class Supplier(BaseModel):
    supplier_id: str
    supplier_name: str
    product_name: str
    unit_cost: float = Field(ge=0)
    available_quantity: int = Field(ge=0)
    lead_time_days: int = Field(ge=0)

class SuppliersResponse(BaseModel):
    suppliers: list[Supplier]
    total: int

class ExportOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    order_id: str | None = Field(default=None, max_length=200)
    customer_name: str | None = Field(default=None, max_length=500)
    product_name: str | None = Field(default=None, max_length=500)
    quantity: int | None = Field(default=None, gt=0, strict=True)
    unit_price: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    status: str | None = Field(default=None, max_length=100)
    risk_level: str | None = Field(default=None, max_length=100)

class ExportRequest(BaseModel):
    orders: list[ExportOrder] = Field(min_length=1, max_length=2000)
