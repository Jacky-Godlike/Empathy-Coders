"""Channel collection adapters for the unified order inbox.

The demo ships with deterministic adapters so a judge can click "Sync now" and
watch a realistic customer message arrive from each platform. In production,
each adapter would call the platform's official API after an OAuth handshake,
or receive signed webhooks. Access tokens belong on the server, never in the
browser.
"""

from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone
from typing import Any

CHANNEL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "id": "CH-WHATSAPP",
        "source": "whatsapp",
        "name": "WhatsApp Business",
        "account": "+60 12-345 6789",
        "connectionMode": "WhatsApp Cloud API",
        "description": "WhatsApp Business messages, including customer orders and enquiries.",
        "status": "connected",
        "autoSync": True,
        "lastSyncAt": None,
        "importedCount": 0,
        "samplesSynced": 0,
        "lastError": None,
    },
    {
        "id": "CH-FACEBOOK",
        "source": "facebook",
        "name": "Facebook Messenger",
        "account": "Kopi Kita Enterprise",
        "connectionMode": "Messenger Platform",
        "description": "Messenger conversations sent to the business Facebook Page.",
        "status": "needs_attention",
        "autoSync": False,
        "lastSyncAt": None,
        "importedCount": 0,
        "samplesSynced": 0,
        "lastError": "Page access token needs reauthorisation.",
    },
    {
        "id": "CH-INSTAGRAM",
        "source": "instagram",
        "name": "Instagram DM",
        "account": "@kopikita.my",
        "connectionMode": "Instagram Graph API",
        "description": "Instagram DMs, story replies and product enquiries.",
        "status": "connected",
        "autoSync": True,
        "lastSyncAt": None,
        "importedCount": 0,
        "samplesSynced": 0,
        "lastError": None,
    },
    {
        "id": "CH-TELEGRAM",
        "source": "telegram",
        "name": "Telegram Business",
        "account": "@kopikitamy",
        "connectionMode": "Telegram Bot API",
        "description": "Telegram business bot messages and customer groups.",
        "status": "connected",
        "autoSync": True,
        "lastSyncAt": None,
        "importedCount": 0,
        "samplesSynced": 0,
        "lastError": None,
    },
    {
        "id": "CH-EMAIL",
        "source": "email",
        "name": "Email Inbox",
        "account": "orders@kopikita.my",
        "connectionMode": "IMAP / order mailbox",
        "description": "Order mailbox emails, including replies and text attachments.",
        "status": "connected",
        "autoSync": True,
        "lastSyncAt": None,
        "importedCount": 0,
        "samplesSynced": 0,
        "lastError": None,
    },
    {
        "id": "CH-TIKTOK",
        "source": "tiktok",
        "name": "TikTok Business",
        "account": "@kopikita.my",
        "connectionMode": "TikTok Business Messaging",
        "description": "TikTok business messages and enquiries from viral content.",
        "status": "not_connected",
        "autoSync": False,
        "lastSyncAt": None,
        "importedCount": 0,
        "samplesSynced": 0,
        "lastError": None,
    },
]

# Deterministic sample inbound messages used by the demo connector. Each sync
# advances through the bank so repeated clicks do not produce identical rows.
CHANNEL_SAMPLES: dict[str, list[dict[str, str]]] = {
    "CH-WHATSAPP": [
        {
            "sender": "Aina Catering",
            "contact": "+60 12-441 8820",
            "originalText": (
                "Hi, can I order 30 packs of nasi lemak and 30 sachets of kopi "
                "3-in-1 for Friday 9am? Deliver to 12 Jalan SS 2/30, Petaling Jaya."
            ),
        },
        {
            "sender": "Hafiz Zulkifli",
            "contact": "+60 19-773 1120",
            "originalText": (
                "Salam, nak order 20 kotak kuih lapis dan 15 sachet teh tarik "
                "untuk mesyuarat esok pagi. Boleh hantar ke Bangsar sebelum 8.30 pagi?"
            ),
        },
    ],
    "CH-FACEBOOK": [
        {
            "sender": "Kafe Aina",
            "contact": "m.me/kafeaina",
            "originalText": (
                "Hello! We are opening a cafe and need 50 packs of nasi lemak "
                "and 50 sachets of kopi 3-in-1 for Saturday morning. Deliver to "
                "8 Jalan Telawi 2, Bangsar."
            ),
        },
        {
            "sender": "Siti Nurhaliza",
            "contact": "m.me/siti.n",
            "originalText": (
                "Hi, do you make custom kuih boxes? I need 12 boxes of kuih "
                "lapis for a birthday this Sunday. Please send me the price."
            ),
        },
    ],
    "CH-INSTAGRAM": [
        {
            "sender": "@thestudio.kl",
            "contact": "Instagram DM",
            "originalText": (
                "Saw your reel! Can I reserve 3 kaya toast sets and 10 sachets "
                "of kopi 3-in-1 for pickup on Saturday at 3pm?"
            ),
        },
        {
            "sender": "@maya.eats",
            "contact": "Instagram DM",
            "originalText": (
                "Hi! Are the kuih lapis boxes still available? I would like 8 "
                "boxes delivered to Damansara Heights tomorrow afternoon."
            ),
        },
    ],
    "CH-TELEGRAM": [
        {
            "sender": "Ravi (TechMeet KL)",
            "contact": "@ravitech",
            "originalText": (
                "Please quote 40 packs of nasi lemak and 40 sachets of teh tarik "
                "for a workshop on 30 October at 12pm. Deliver to Menara Oasis."
            ),
        },
        {
            "sender": "Farah",
            "contact": "@farahhh",
            "originalText": (
                "Hi, can I add 20 kuih lapis boxes and 20 kopi sachets to my "
                "existing office order for tomorrow? Same address as last time."
            ),
        },
    ],
    "CH-EMAIL": [
        {
            "sender": "Nadia Rahman (Northstar Design)",
            "contact": "nadia@northstar.example",
            "originalText": (
                "Subject: Friday client breakfast\n\nHi Kopi Kita,\nPlease prepare "
                "25 kaya toast sets and 25 sachets of kopi 3-in-1 for Friday at "
                "9am. Deliver to Level 12, Menara Northstar. Please invoice the "
                "company account."
            ),
        },
        {
            "sender": "Daniel Lim",
            "contact": "daniel@limco.example",
            "originalText": (
                "Subject: Order for 30 pax\n\nCould you send a quotation for 30 "
                "nasi lemak packs and 30 teh tarik sachets next Tuesday? Delivery "
                "to our office in Subang Jaya."
            ),
        },
    ],
    "CH-TIKTOK": [
        {
            "sender": "@crunchyclaire",
            "contact": "TikTok Business message",
            "originalText": (
                "I saw the viral kuih lapis video! Can I order 15 boxes for "
                "delivery this weekend?"
            ),
        },
        {
            "sender": "@weekendwithwei",
            "contact": "TikTok Business message",
            "originalText": (
                "Hi, do you deliver to Cheras? I want to order 20 nasi lemak "
                "packs and 10 kopi sachets for a birthday on Sunday."
            ),
        },
    ],
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_channels(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Add channel state to older demo databases without destroying edits."""

    existing = {
        item.get("id"): item
        for item in data.get("channels", [])
        if isinstance(item, dict) and item.get("id")
    }
    channels: list[dict[str, Any]] = []
    for definition in CHANNEL_DEFINITIONS:
        stored = copy.deepcopy(definition)
        stored.update(copy.deepcopy(existing.get(definition["id"], {})))
        channels.append(stored)
    data["channels"] = channels
    return channels


def get_channel(data: dict[str, Any], channel_id: str) -> dict[str, Any]:
    channels = ensure_channels(data)
    channel = next((item for item in channels if item["id"] == channel_id), None)
    if not channel:
        raise KeyError(channel_id)
    return channel


def channel_public_view(channel: dict[str, Any]) -> dict[str, Any]:
    """Return only data safe/useful to the browser (no platform tokens)."""

    return {
        "id": channel["id"],
        "source": channel["source"],
        "name": channel["name"],
        "account": channel["account"],
        "connectionMode": channel["connectionMode"],
        "description": channel["description"],
        "status": channel["status"],
        "autoSync": bool(channel.get("autoSync")),
        "lastSyncAt": channel.get("lastSyncAt"),
        "importedCount": int(channel.get("importedCount") or 0),
        "lastError": channel.get("lastError"),
        "webhookPath": f"/api/channels/{channel['id']}/webhook",
    }


def next_sample(channel: dict[str, Any]) -> dict[str, str]:
    samples = CHANNEL_SAMPLES.get(channel["id"], [])
    if not samples:
        raise ValueError(f"No demo sample configured for {channel['id']}")
    index = int(channel.get("samplesSynced") or 0) % len(samples)
    sample = dict(samples[index])
    sample["channelAccount"] = channel["account"]
    sample["externalId"] = f"{channel['id'].lower()}-{index + 1}"
    sample["timestamp"] = _now_iso()
    return sample


def mark_connected(channel: dict[str, Any]) -> None:
    channel["status"] = "connected"
    channel["autoSync"] = True
    channel["lastError"] = None


def mark_disconnected(channel: dict[str, Any]) -> None:
    channel["status"] = "not_connected"
    channel["autoSync"] = False


def mark_synced(channel: dict[str, Any]) -> None:
    channel["lastSyncAt"] = _now_iso()
    channel["importedCount"] = int(channel.get("importedCount") or 0) + 1
    channel["samplesSynced"] = int(channel.get("samplesSynced") or 0) + 1


def initial_channel_timestamps(data: dict[str, Any]) -> None:
    """Make a fresh demo look lived-in without inventing extra messages."""

    if data.get("_channelTimestampsSeeded"):
        return
    now = datetime.now(timezone.utc)
    offsets = {
        "CH-WHATSAPP": 7,
        "CH-INSTAGRAM": 19,
        "CH-TELEGRAM": 31,
        "CH-EMAIL": 12,
    }
    for channel in ensure_channels(data):
        if channel["id"] in offsets and not channel.get("lastSyncAt"):
            channel["lastSyncAt"] = (
                now - timedelta(minutes=offsets[channel["id"]])
            ).isoformat()
    data["_channelTimestampsSeeded"] = True
