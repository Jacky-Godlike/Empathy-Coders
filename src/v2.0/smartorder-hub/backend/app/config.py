"""Runtime configuration for SmartOrder Hub.

Every threshold is an environment variable so the demo can be reset without
editing code. The defaults are the policy used in the demo video.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_DIR = BACKEND_DIR.parent

# Local convenience: backend/.env is never committed.
load_dotenv(BACKEND_DIR / ".env")

DATA_DIR = Path(os.getenv("SMARTORDERHUB_DATA_DIR", str(APP_DIR / "data")))
FRONTEND_DIST = Path(
    os.getenv("SMARTORDERHUB_FRONTEND_DIST", str(PROJECT_DIR / "frontend" / "dist"))
)

# Commercial policy. These are business rules, not AI output.
MIN_MARGIN = float(os.getenv("SMARTORDERHUB_MIN_MARGIN", "0.15"))
WARN_MARGIN = float(os.getenv("SMARTORDERHUB_WARN_MARGIN", "0.20"))
HIGH_VALUE_THRESHOLD = float(
    os.getenv("SMARTORDERHUB_HIGH_VALUE_THRESHOLD", "1000")
)
LEAD_TIME_BUFFER_DAYS = int(os.getenv("SMARTORDERHUB_LEAD_TIME_BUFFER_DAYS", "1"))
MIN_CONFIDENCE = float(os.getenv("SMARTORDERHUB_MIN_CONFIDENCE", "0.80"))
RISK_MEDIUM_THRESHOLD = float(os.getenv("SMARTORDERHUB_RISK_MEDIUM_THRESHOLD", "25"))
RISK_HIGH_THRESHOLD = float(os.getenv("SMARTORDERHUB_RISK_HIGH_THRESHOLD", "50"))
RISK_CRITICAL_THRESHOLD = float(
    os.getenv("SMARTORDERHUB_RISK_CRITICAL_THRESHOLD", "75")
)

# AI is optional. When the key is absent, extraction falls back to rules.
# "gemini" is the default provider. Set AI_PROVIDER=openai to use any
# OpenAI-compatible chat-completions endpoint (including self-hosted gateways).
AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini").strip().lower()
if AI_PROVIDER in ("openai-compatible", "openai_compatible", "compatible"):
    AI_PROVIDER = "openai"
if AI_PROVIDER not in ("gemini", "openai"):
    AI_PROVIDER = "gemini"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

if AI_PROVIDER == "gemini":
    AI_API_KEY = os.getenv("AI_API_KEY", "") or GEMINI_API_KEY
    AI_MODEL = os.getenv("AI_MODEL", "") or GEMINI_MODEL
else:
    AI_API_KEY = os.getenv("AI_API_KEY", "")
    AI_MODEL = os.getenv("AI_MODEL", "") or "gpt-4o-mini"

AI_BASE_URL = os.getenv("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "30"))

# Bulk intake defaults to the deterministic rule engine so a 30+ message demo
# is instant and never depends on a network call. Set to "auto" to use the AI
# provider for the bulk pass as well.
INTAKE_MODE = os.getenv("SMARTORDERHUB_INTAKE_MODE", "rules").lower()
if INTAKE_MODE not in ("auto", "ai", "rules"):
    INTAKE_MODE = "rules"

# Channel collection. Set a token in production so webhook calls can be
# authenticated with X-Webhook-Token. Leave empty for the local demo.
CHANNEL_WEBHOOK_TOKEN = os.getenv("SMARTORDERHUB_CHANNEL_WEBHOOK_TOKEN", "")
