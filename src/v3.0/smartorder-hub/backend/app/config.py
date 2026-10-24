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
        # A generic key must not be sent to DeepSeek's default endpoint just
        # because no provider was named. Keep it on the generic OpenAI path
        # unless the configured base URL/model clearly says DeepSeek.
        return "deepseek" if _is_deepseek_endpoint(base_url, model) else "openai"
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


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in ("0", "false", "no", "off", "")


# Read-only email mailbox connector. These are the recommended production
# settings: keep the password in Replit Secrets, never in the repository.
# The in-app connect flow stores credentials in process memory only.
EMAIL_IMAP_HOST = os.getenv("EMAIL_IMAP_HOST", "").strip()
EMAIL_IMAP_PORT = _int_env("EMAIL_IMAP_PORT", 993)
EMAIL_IMAP_USER = os.getenv("EMAIL_IMAP_USER", "").strip()
EMAIL_IMAP_PASSWORD = os.getenv("EMAIL_IMAP_PASSWORD", "")
EMAIL_IMAP_MAILBOX = os.getenv("EMAIL_IMAP_MAILBOX", "INBOX").strip() or "INBOX"
EMAIL_IMAP_SSL = _bool_env("EMAIL_IMAP_SSL", True)
EMAIL_MAX_MESSAGES = max(1, min(100, _int_env("EMAIL_MAX_MESSAGES", 20)))
# 0 disables the background poller (useful for tests).
EMAIL_POLL_SECONDS = max(0, _int_env("EMAIL_POLL_SECONDS", 60))
# Refuse to download a single huge message (including attachments).
EMAIL_MAX_MESSAGE_BYTES = max(
    10_000, min(10_000_000, _int_env("EMAIL_MAX_MESSAGE_BYTES", 1_000_000))
)
# Comma-separated allowlist. Empty means any public hostname; private/loopback
# targets are still rejected unless explicitly allowed for local testing.
EMAIL_ALLOWED_HOSTS = [
    value.strip().lower()
    for value in os.getenv("EMAIL_ALLOWED_HOSTS", "").split(",")
    if value.strip()
]
EMAIL_ALLOWED_PORTS = {
    int(value.strip())
    for value in os.getenv("EMAIL_ALLOWED_PORTS", "143,993").split(",")
    if value.strip().isdigit()
} or {143, 993}
EMAIL_ALLOW_PRIVATE_HOSTS = _bool_env("EMAIL_ALLOW_PRIVATE_HOSTS", False)

# Optional shared owner password for the simulated demo identity. When set,
# owner actions require X-Owner-Password in addition to X-Demo-Role: owner.
# This is still not a multi-user auth system; use Orbyte SSO/reverse proxy for
# a public production deployment.
OWNER_PASSWORD = os.getenv("SMARTORDERHUB_OWNER_PASSWORD", "")

# Browser origins allowed to call the API directly. In production the React
# build is served by the same FastAPI origin, so this list is only for local
# Vite/dev previews. Set SMARTORDERHUB_CORS_ORIGINS to a comma-separated list.
CORS_ORIGINS = [
    value.strip()
    for value in os.getenv(
        "SMARTORDERHUB_CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:8100,http://127.0.0.1:8100",
    ).split(",")
    if value.strip() and value.strip() != "*"
]

# Reject oversized JSON bodies before FastAPI/Pydantic parses them.
MAX_REQUEST_BYTES = max(
    100_000, min(10_000_000, _int_env("SMARTORDERHUB_MAX_REQUEST_BYTES", 1_000_000))
)

# Interactive API docs are useful locally but expose the whole route surface.
ENABLE_API_DOCS = _bool_env("SMARTORDERHUB_ENABLE_API_DOCS", False)
