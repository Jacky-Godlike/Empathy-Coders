"""Request bodies accepted by the API.

Response objects are plain JSON documents stored in `data/db.json`; keeping
them as dictionaries makes the demo easy to inspect and reset. Request bodies
are validated here so malformed input never reaches the rule engine.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

Source = Literal["whatsapp", "email", "manual"]
MessageStatus = Literal[
    "not_analyzed",
    "processing",
    "recognized_as_order",
    "not_an_order",
    "needs_human_review",
]
Decision = Literal["approve", "reject", "request_info"]
Role = Literal["staff", "manager", "owner"]


class MessageCreate(BaseModel):
    source: Source = "whatsapp"
    sender: str = ""
    contact: Optional[str] = None
    originalText: str = Field(min_length=1, max_length=5000)
    timestamp: Optional[str] = None


class ExtractRequest(BaseModel):
    mode: Literal["auto", "ai", "rules"] = "auto"


class MessagePatch(BaseModel):
    status: Optional[MessageStatus] = None
    reviewNotes: Optional[str] = None
    parsedData: Optional[dict[str, Any]] = None


class IndustryChange(BaseModel):
    industry: str


class DecisionRequest(BaseModel):
    decision: Decision
    actor: str = "Demo Owner"
    role: Role = "owner"
    note: str = ""
    override: bool = False
