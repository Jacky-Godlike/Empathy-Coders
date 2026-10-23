"""Request bodies accepted by the API.

Response objects are plain JSON documents stored in `data/db.json`; keeping
them as dictionaries makes the demo easy to inspect and reset. Request bodies
are validated here so malformed input never reaches the rule engine.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

Source = Literal[
    "whatsapp",
    "facebook",
    "instagram",
    "telegram",
    "email",
    "tiktok",
    "manual",
]
MessageStatus = Literal[
    "not_analyzed",
    "processing",
    "recognized_as_order",
    "not_an_order",
    "needs_human_review",
]
Decision = Literal["approve", "reject", "request_info"]
Role = Literal["staff", "manager", "owner"]
ChannelStatus = Literal["connected", "needs_attention", "not_connected"]


class MessageCreate(BaseModel):
    source: Source = "whatsapp"
    sender: str = ""
    contact: Optional[str] = None
    channelAccount: Optional[str] = None
    externalId: Optional[str] = None
    originalText: str = Field(min_length=1, max_length=5000)
    timestamp: Optional[str] = None


class ChannelSettings(BaseModel):
    autoSync: Optional[bool] = None


class ChannelWebhookMessage(BaseModel):
    sender: str = Field(min_length=1, max_length=200)
    contact: Optional[str] = None
    originalText: str = Field(min_length=1, max_length=5000)
    externalId: Optional[str] = None
    timestamp: Optional[str] = None


class ExtractRequest(BaseModel):
    mode: Literal["auto", "ai", "rules"] = "auto"


class MessagePatch(BaseModel):
    status: Optional[MessageStatus] = None
    reviewNotes: Optional[str] = None
    parsedData: Optional[dict[str, Any]] = None
    extractionAccurate: Optional[bool] = None


class IndustryChange(BaseModel):
    industry: str


class DecisionRequest(BaseModel):
    decision: Decision
    actor: str = "Demo Owner"
    role: Role = "owner"
    note: str = ""
    override: bool = False
    specialReason: Optional[
        Literal["strategic_customer", "clear_inventory", "new_process", "other"]
    ] = None


class RiskPolicyUpdate(BaseModel):
    minMargin: Optional[float] = Field(default=None, ge=0, le=1)
    warnMargin: Optional[float] = Field(default=None, ge=0, le=1)
    highValueThreshold: Optional[float] = Field(default=None, ge=0)
    leadTimeBufferDays: Optional[int] = Field(default=None, ge=0, le=365)
    minConfidence: Optional[float] = Field(default=None, ge=0, le=1)
    riskMediumThreshold: Optional[float] = Field(default=None, ge=0, le=100)
    riskHighThreshold: Optional[float] = Field(default=None, ge=0, le=100)
    riskCriticalThreshold: Optional[float] = Field(default=None, ge=0, le=100)
    riskWeights: Optional[dict[str, float]] = None


class OrderOutcome(BaseModel):
    actualDeliveredOnTime: Optional[bool] = None
    actualProfit: Optional[float] = None
