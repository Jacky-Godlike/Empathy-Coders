"""Request bodies accepted by the API.

Response objects are plain JSON documents stored in `data/db.json`; keeping
them as dictionaries makes the demo easy to inspect and reset. Request bodies
are validated here so malformed input never reaches the rule engine.
"""

from __future__ import annotations

import json
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, SecretStr, field_validator

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
Role = Literal["staff", "owner"]


class MessageCreate(BaseModel):
    source: Source = "whatsapp"
    sender: str = Field(default="", max_length=200)
    contact: Optional[str] = Field(default=None, max_length=320)
    channelAccount: Optional[str] = Field(default=None, max_length=320)
    originalText: str = Field(min_length=1, max_length=5000)
    timestamp: Optional[str] = Field(default=None, max_length=64)


class ChannelSettings(BaseModel):
    autoSync: Optional[bool] = None


class ChannelWebhookMessage(BaseModel):
    sender: str = Field(min_length=1, max_length=200)
    contact: Optional[str] = Field(default=None, max_length=320)
    originalText: str = Field(min_length=1, max_length=5000)
    externalId: Optional[str] = Field(default=None, max_length=500)
    timestamp: Optional[str] = Field(default=None, max_length=64)


class EmailConfigRequest(BaseModel):
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=993, ge=1, le=65535)
    username: str = Field(min_length=1, max_length=320)
    password: SecretStr = Field(min_length=1, max_length=1024)
    mailbox: str = Field(default="INBOX", min_length=1, max_length=80)
    useSsl: bool = True


class ExtractRequest(BaseModel):
    mode: Literal["auto", "ai", "rules"] = "auto"


class MessagePatch(BaseModel):
    status: Optional[MessageStatus] = None
    reviewNotes: Optional[str] = Field(default=None, max_length=2000)
    parsedData: Optional[dict[str, Any]] = None

    @field_validator("parsedData")
    @classmethod
    def _limit_parsed_data(
        cls, value: Optional[dict[str, Any]]
    ) -> Optional[dict[str, Any]]:
        if value is not None:
            try:
                encoded = json.dumps(
                    value,
                    ensure_ascii=False,
                    separators=(",", ":"),
                    allow_nan=False,
                )
            except (TypeError, ValueError) as exc:
                raise ValueError(
                    "parsedData must contain only finite JSON values."
                ) from exc
            if len(encoded) > 50_000:
                raise ValueError("parsedData must be 50 KB or smaller.")
        return value


class IndustryChange(BaseModel):
    industry: str = Field(min_length=1, max_length=40)


class OwnerLoginRequest(BaseModel):
    password: SecretStr = Field(min_length=1, max_length=1024)


class DecisionRequest(BaseModel):
    decision: Decision
    # Kept for older clients; the server uses X-Demo-Role/X-Demo-Actor.
    actor: str = Field(default="Demo Owner", max_length=80)
    role: Role = "owner"
    note: str = Field(default="", max_length=2000)
    override: bool = False
