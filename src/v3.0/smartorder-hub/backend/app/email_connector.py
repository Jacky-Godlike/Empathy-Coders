"""Read-only IMAP connector for a business order mailbox.

The connector is deliberately small: it logs in with an app password, reads
the latest messages in one mailbox, converts them to the same normalised shape
as the other channels, and never sends, deletes or marks a message as read.

Credentials are never written to ``db.json``. They can come from environment
variables (the production/Replit path) or from the in-app connect flow, which
keeps them in this process's memory for the current session only.
"""

from __future__ import annotations

import email
import imaplib
import ipaddress
import re
import socket
import ssl
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.header import decode_header
from email.message import Message
from email.policy import default
from email.utils import parseaddr, parsedate_to_datetime
from html.parser import HTMLParser
from typing import Optional

from . import config

MAX_BODY_CHARS = 5000
_MAILBOX_RE = re.compile(r"^[A-Za-z0-9 _./@\[\]-]{1,80}$")
_REPLY_MARKER_RE = re.compile(
    r"^(On .+ wrote:|-----Original Message-----|From: .+|Sent: .+)$", re.IGNORECASE
)


class EmailConnectorError(Exception):
    """An error that is safe to show to the operator."""


class EmailAuthError(EmailConnectorError):
    """The mailbox rejected the username or password."""


class EmailConnectionError(EmailConnectorError):
    """The mailbox could not be reached or did not speak IMAP."""


@dataclass(frozen=True)
class EmailConfig:
    host: str
    port: int
    username: str
    password: str = field(repr=False)
    mailbox: str = "INBOX"
    use_ssl: bool = True
    max_messages: int = 20
    max_message_bytes: int = 1_000_000


_session_config: Optional[EmailConfig] = None


def _env_config() -> Optional[EmailConfig]:
    """Return the server-secret configuration, if all required values exist."""

    if not (
        config.EMAIL_IMAP_HOST
        and config.EMAIL_IMAP_USER
        and config.EMAIL_IMAP_PASSWORD
    ):
        return None
    return EmailConfig(
        host=config.EMAIL_IMAP_HOST,
        port=config.EMAIL_IMAP_PORT,
        username=config.EMAIL_IMAP_USER,
        password=config.EMAIL_IMAP_PASSWORD,
        mailbox=config.EMAIL_IMAP_MAILBOX or "INBOX",
        use_ssl=config.EMAIL_IMAP_SSL,
        max_messages=config.EMAIL_MAX_MESSAGES,
        max_message_bytes=config.EMAIL_MAX_MESSAGE_BYTES,
    )


def current_config() -> Optional[EmailConfig]:
    """Session credentials override environment credentials for this process."""

    return _session_config or _env_config()


def is_configured() -> bool:
    return current_config() is not None


def config_source() -> Optional[str]:
    if _session_config is not None:
        return "session"
    if _env_config() is not None:
        return "environment"
    return None


def set_session_config(cfg: EmailConfig) -> None:
    global _session_config
    _session_config = cfg


def clear_session_config() -> None:
    global _session_config
    _session_config = None


def build_config(
    host: str,
    port: int,
    username: str,
    password: str,
    mailbox: str = "INBOX",
    use_ssl: bool = True,
) -> EmailConfig:
    """Validate a browser-supplied mailbox configuration."""

    host = (host or "").strip()
    username = (username or "").strip()
    password = password or ""
    mailbox = (mailbox or "INBOX").strip() or "INBOX"

    if (
        not host
        or len(host) > 255
        or any(char.isspace() for char in host)
        or any(ord(char) < 32 or ord(char) == 127 for char in host)
    ):
        raise EmailConnectorError(
            "Enter a valid IMAP host, for example imap.gmail.com."
        )
    if (
        not username
        or len(username) > 320
        or any(ord(char) < 32 or ord(char) == 127 for char in username)
    ):
        raise EmailConnectorError("Enter the mailbox address.")
    if not password:
        raise EmailConnectorError("Enter the mailbox password or app password.")
    if any(character in password for character in ("\r", "\n", "\x00")):
        raise EmailConnectorError("Mailbox password contains invalid control characters.")
    if not isinstance(port, int) or not 1 <= port <= 65535:
        raise EmailConnectorError("Port must be between 1 and 65535.")
    if not _MAILBOX_RE.match(mailbox):
        raise EmailConnectorError("Mailbox folder contains unsupported characters.")
    _validate_host(host, port)

    return EmailConfig(
        host=host,
        port=port,
        username=username,
        password=password,
        mailbox=mailbox,
        use_ssl=bool(use_ssl),
        max_messages=config.EMAIL_MAX_MESSAGES,
        max_message_bytes=config.EMAIL_MAX_MESSAGE_BYTES,
    )


def _validate_host(host: str, port: int) -> None:
    """Reject obvious SSRF targets unless the operator allows local testing."""

    if port not in config.EMAIL_ALLOWED_PORTS:
        allowed = ", ".join(str(item) for item in sorted(config.EMAIL_ALLOWED_PORTS))
        raise EmailConnectorError(
            f"IMAP port {port} is not allowed. Allowed ports: {allowed}."
        )

    if config.EMAIL_ALLOWED_HOSTS:
        allowed = host.lower().strip(".")
        if not any(
            allowed == item or allowed.endswith("." + item)
            for item in config.EMAIL_ALLOWED_HOSTS
        ):
            raise EmailConnectorError(
                "This IMAP host is not in EMAIL_ALLOWED_HOSTS."
            )

    if config.EMAIL_ALLOW_PRIVATE_HOSTS:
        return

    try:
        addresses = {
            info[4][0]
            for info in socket.getaddrinfo(
                host, port, type=socket.SOCK_STREAM
            )
        }
    except socket.gaierror as exc:
        raise EmailConnectorError(
            "The IMAP host could not be resolved."
        ) from exc

    for address in addresses:
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            continue
        if not ip.is_global:
            raise EmailConnectorError(
                "Private, loopback, link-local and non-global IMAP hosts "
                "are blocked. Set EMAIL_ALLOW_PRIVATE_HOSTS=true only for "
                "local testing."
            )


def _mailbox_arg(mailbox: str) -> str:
    return '"' + mailbox.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _logout(conn: imaplib.IMAP4) -> None:
    try:
        conn.logout()
    except Exception:  # noqa: BLE001 - logout is best effort
        pass


def _connect(cfg: EmailConfig) -> imaplib.IMAP4:
    _validate_host(cfg.host, cfg.port)
    if not _MAILBOX_RE.match(cfg.mailbox):
        raise EmailConnectionError("Mailbox folder contains unsupported characters.")
    if any(character in cfg.password for character in ("\r", "\n", "\x00")):
        raise EmailAuthError("Mailbox password contains invalid control characters.")
    tls_context = ssl.create_default_context()
    try:
        if cfg.use_ssl:
            conn: imaplib.IMAP4 = imaplib.IMAP4_SSL(
                cfg.host, cfg.port, timeout=15, ssl_context=tls_context
            )
        else:
            conn = imaplib.IMAP4(cfg.host, cfg.port, timeout=15)
            conn.starttls(ssl_context=tls_context)
    except Exception as exc:  # noqa: BLE001 - convert to operator-safe message
        raise EmailConnectionError(
            f"Could not reach {cfg.host}:{cfg.port}. "
            "Check the host, port and SSL setting."
        ) from exc

    try:
        conn.login(cfg.username, cfg.password)
    except imaplib.IMAP4.error as exc:
        _logout(conn)
        raise EmailAuthError(
            "Mailbox login failed. Check the address and app password."
        ) from exc
    except Exception as exc:  # noqa: BLE001
        _logout(conn)
        raise EmailConnectionError(f"Mailbox login failed: {exc}") from exc
    return conn


def test_connection(cfg: Optional[EmailConfig] = None) -> dict:
    """Log in and select the mailbox without reading or changing messages."""

    cfg = cfg or current_config()
    if not cfg:
        raise EmailConnectorError("Email is not configured yet.")

    conn = _connect(cfg)
    try:
        status, _ = conn.select(_mailbox_arg(cfg.mailbox), readonly=True)
        if status != "OK":
            raise EmailConnectionError(
                f"Mailbox folder '{cfg.mailbox}' could not be opened."
            )
        status, data = conn.search(None, "ALL")
        if status != "OK":
            raise EmailConnectionError("The mailbox search failed.")
        count = len((data[0] or b"").split()) if data and data[0] else 0
        return {
            "ok": True,
            "host": cfg.host,
            "username": cfg.username,
            "mailbox": cfg.mailbox,
            "messages": count,
        }
    except (imaplib.IMAP4.error, OSError) as exc:
        raise EmailConnectionError(f"Mailbox error: {exc}") from exc
    finally:
        _logout(conn)


def _message_size(conn: imaplib.IMAP4, uid: bytes) -> Optional[int]:
    try:
        status, data = conn.uid("fetch", uid, "(RFC822.SIZE)")
    except (imaplib.IMAP4.error, OSError):
        return None
    if status != "OK":
        return None
    for part in data or []:
        raw = part[0] if isinstance(part, tuple) else part
        if isinstance(raw, bytes):
            match = re.search(rb"RFC822\.SIZE\s+(\d+)", raw, re.IGNORECASE)
            if match:
                return int(match.group(1))
    return None


def fetch_messages(cfg: Optional[EmailConfig] = None) -> list[dict]:
    """Return the newest messages as normalised channel payloads.

    The whole mailbox is searched, but only the newest ``max_messages`` are
    downloaded. Deduplication happens later in the shared inbox by
    ``source + externalId`` (the Message-ID).
    """

    cfg = cfg or current_config()
    if not cfg:
        raise EmailConnectorError("Email is not configured yet.")

    conn = _connect(cfg)
    try:
        status, _ = conn.select(_mailbox_arg(cfg.mailbox), readonly=True)
        if status != "OK":
            raise EmailConnectionError(
                f"Mailbox folder '{cfg.mailbox}' could not be opened."
            )
        status, data = conn.uid("search", None, "ALL")
        if status != "OK":
            raise EmailConnectionError("The mailbox search failed.")

        uids = (data[0] or b"").split()
        selected = uids[-max(1, cfg.max_messages) :]
        payloads: list[dict] = []
        for uid in reversed(selected):
            size = _message_size(conn, uid)
            if size is not None and size > cfg.max_message_bytes:
                continue
            status, message_data = conn.uid("fetch", uid, "(RFC822)")
            if status != "OK":
                continue
            raw = next(
                (
                    part[1]
                    for part in message_data
                    if isinstance(part, tuple) and len(part) >= 2
                ),
                None,
            )
            if not raw or len(raw) > cfg.max_message_bytes:
                continue
            message = email.message_from_bytes(raw, policy=default)
            payloads.append(
                message_to_payload(
                    message,
                    uid.decode("ascii", errors="ignore") or "unknown",
                    cfg,
                )
            )
        return payloads
    except (imaplib.IMAP4.error, OSError) as exc:
        raise EmailConnectionError(f"Mailbox read failed: {exc}") from exc
    finally:
        _logout(conn)


def _header(message: Message, name: str) -> str:
    value = message.get(name, "")
    return str(value).strip() if value is not None else ""


def _decode_header(value: str) -> str:
    if not value:
        return ""
    parts: list[str] = []
    for chunk, charset in decode_header(value):
        if isinstance(chunk, bytes):
            try:
                parts.append(chunk.decode(charset or "utf-8", errors="replace"))
            except LookupError:
                parts.append(chunk.decode("utf-8", errors="replace"))
        else:
            parts.append(chunk)
    return " ".join("".join(parts).split())


def _part_text(part: Message) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        return ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


class _HTMLTextExtractor(HTMLParser):
    """Linear HTML-to-text extractor; never regex-match untrusted HTML."""

    _BLOCK_TAGS = {
        "br",
        "div",
        "p",
        "li",
        "tr",
        "td",
        "th",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.lower()
        if tag in ("script", "style"):
            self._skip_depth += 1
        elif tag in self._BLOCK_TAGS:
            self.parts.append("\n")

    def handle_startendtag(self, tag: str, attrs) -> None:
        if tag.lower() in self._BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in ("script", "style"):
            if self._skip_depth:
                self._skip_depth -= 1
        elif tag in self._BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skip_depth:
            self.parts.append(data)

    def text(self) -> str:
        return "".join(self.parts)


def _html_to_text(value: str) -> str:
    parser = _HTMLTextExtractor()
    try:
        parser.feed(value[:200_000])
        parser.close()
    except Exception:  # noqa: BLE001 - malformed HTML must not break intake
        return re.sub(r"<[^>]{0,500}>", " ", value[:200_000])
    return parser.text()


def _extract_body(message: Message) -> str:
    if message.is_multipart():
        plain: Optional[str] = None
        html: Optional[str] = None
        for part in message.walk():
            if part.get_content_disposition() == "attachment":
                continue
            content_type = part.get_content_type()
            if content_type == "text/plain" and plain is None:
                plain = _part_text(part)
            elif content_type == "text/html" and html is None:
                html = _part_text(part)
        if plain and plain.strip():
            return plain
        return _html_to_text(html or "")

    if message.get_content_type() == "text/html":
        return _html_to_text(_part_text(message))
    return _part_text(message)


def _clean_text(value: str) -> str:
    """Remove quoted replies, signatures and excessive whitespace."""

    lines: list[str] = []
    for line in value.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        stripped = line.strip()
        if stripped.startswith(">"):
            continue
        if len(lines) >= 3 and _REPLY_MARKER_RE.match(stripped):
            break
        if stripped == "--" and len(lines) >= 3:
            break
        lines.append(line.rstrip())

    cleaned = "\n".join(lines).strip()
    return re.sub(r"\n{3,}", "\n\n", cleaned)


def _message_timestamp(value: str) -> str:
    if value:
        try:
            parsed = parsedate_to_datetime(value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            pass
    return datetime.now(timezone.utc).isoformat()


def message_to_payload(
    message: Message, uid: str, cfg: EmailConfig
) -> dict:
    """Map an RFC 822 message to the shared inbox payload shape."""

    message_id = _header(message, "Message-ID")
    subject = _decode_header(_header(message, "Subject"))
    from_name, from_email = parseaddr(_header(message, "From"))
    sender = _decode_header(from_name) or from_email or "Unknown"

    body = _clean_text(_extract_body(message))
    text = f"Subject: {subject}\n\n{body}".strip() if subject else body
    text = text[:MAX_BODY_CHARS].strip()
    if not text:
        text = subject or "[Email with no readable text body]"

    return {
        "sender": sender[:200],
        "contact": from_email[:320] or None,
        "originalText": text,
        "externalId": (message_id or f"imap-{cfg.username}-{uid}")[:500],
        "timestamp": _message_timestamp(_header(message, "Date")),
    }


def status() -> dict:
    """Public, password-free connector state for the UI."""

    cfg = current_config()
    return {
        "configured": cfg is not None,
        "source": config_source(),
        "host": cfg.host if cfg else None,
        "port": cfg.port if cfg else None,
        "username": cfg.username if cfg else None,
        "mailbox": cfg.mailbox if cfg else None,
        "useSsl": cfg.use_ssl if cfg else None,
        "maxMessages": cfg.max_messages if cfg else config.EMAIL_MAX_MESSAGES,
        "maxMessageBytes": (
            cfg.max_message_bytes if cfg else config.EMAIL_MAX_MESSAGE_BYTES
        ),
        "pollSeconds": config.EMAIL_POLL_SECONDS,
        "passwordSet": cfg is not None,
    }
