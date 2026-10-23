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
MIN_CONFIDENCE = float(os.getenv("SMARTORDERHUB_MIN_CONFIDENCE", "0.70"))

# AI is optional. When the key is absent, extraction falls back to rules.
#
# SmartOrder Hub supports three provider shapes:
#   deepseek  -> OpenAI-compatible DeepSeek Flash (default)
#   openai    -> any other OpenAI-compatible endpoint
#   gemini    -> Google Gemini
#
# AI_PROVIDER may be "auto" (default). The resolver also inspects the key and
# base URL so an older deployment that still says AI_PROVIDER=gemini but has a
# DeepSeek key is displayed and called as DeepSeek.
def _is_deepseek_endpoint(base_url: str, model: str) -> bool:
    return "deepseek" in (base_url or "").lower() or (model or "").lower().startswith(
        "deepseek"
    )


def detect_provider(
    configured_provider: str,
    deepseek_key: str = "",
    gemini_key: str = "",
    generic_key: str = "",
    base_url: str = "",
    model: str = "",
) -> str:
    raw = (configured_provider or "auto").strip().lower()
    deepseek_like = bool(deepseek_key) or _is_deepseek_endpoint(base_url, model)

    if raw in ("deepseek", "deepseek-flash", "deepseek_flash", "deepseekflash"):
        return "deepseek"
    if raw in ("gemini", "google"):
        # Keep an explicitly configured Gemini workspace, unless it has no
        # Gemini key while a DeepSeek key/base URL is present.
        if gemini_key or not deepseek_like:
            return "gemini"
        return "deepseek"
    if raw in ("openai", "openai-compatible", "openai_compatible", "compatible"):
        return "deepseek" if _is_deepseek_endpoint(base_url, model) else "openai"
    # auto / empty
    if deepseek_key:
        return "deepseek"
    if deepseek_like:
        return "deepseek"
    if gemini_key:
        return "gemini"
    if generic_key:
        return "deepseek"
    return "deepseek"


AI_PROVIDER_RAW = os.getenv("AI_PROVIDER", "auto").strip().lower()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-flash")
DEEPSEEK_BASE_URL = os.getenv(
    "DEEPSEEK_BASE_URL", "https://api.deepseek.com"
).rstrip("/")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
_GENERIC_API_KEY = os.getenv("AI_API_KEY", "")
_GENERIC_MODEL = os.getenv("AI_MODEL", "")
_GENERIC_BASE_URL = os.getenv("AI_BASE_URL", "").rstrip("/")

AI_PROVIDER = detect_provider(
    AI_PROVIDER_RAW,
    deepseek_key=DEEPSEEK_API_KEY,
    gemini_key=GEMINI_API_KEY,
    generic_key=_GENERIC_API_KEY,
    base_url=_GENERIC_BASE_URL,
    model=_GENERIC_MODEL,
)

if AI_PROVIDER == "deepseek":
    if DEEPSEEK_API_KEY or not _GENERIC_API_KEY:
        AI_API_KEY = DEEPSEEK_API_KEY
        AI_KEY_ENV = "DEEPSEEK_API_KEY"
    else:
        AI_API_KEY = _GENERIC_API_KEY
        AI_KEY_ENV = "AI_API_KEY"
    AI_MODEL = _GENERIC_MODEL or DEEPSEEK_MODEL
    AI_BASE_URL = _GENERIC_BASE_URL or DEEPSEEK_BASE_URL
    AI_KEY_URL = "https://platform.deepseek.com/api_keys"
elif AI_PROVIDER == "gemini":
    if GEMINI_API_KEY:
        AI_API_KEY = GEMINI_API_KEY
        AI_KEY_ENV = "GEMINI_API_KEY"
    else:
        AI_API_KEY = _GENERIC_API_KEY
        AI_KEY_ENV = "AI_API_KEY"
    AI_MODEL = _GENERIC_MODEL or GEMINI_MODEL
    AI_BASE_URL = ""
    AI_KEY_URL = "https://aistudio.google.com/app/apikey"
else:
    AI_API_KEY = _GENERIC_API_KEY
    AI_KEY_ENV = "AI_API_KEY"
    AI_MODEL = _GENERIC_MODEL or "gpt-4o-mini"
    AI_BASE_URL = _GENERIC_BASE_URL or "https://api.openai.com/v1"
    AI_KEY_URL = "https://platform.openai.com/api-keys"

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
