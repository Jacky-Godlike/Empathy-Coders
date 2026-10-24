"""A tiny JSON document store.

The whole demo state lives in one inspectable `db.json`. Writes are atomic so a
crashed request cannot leave a half-written file. This is deliberately not a
database: the hackathon brief allows JSON files, and the reset button is part
of the demo.
"""

from __future__ import annotations

import copy
import json
import os
import re
import tempfile
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows fallback
    fcntl = None

from .seed import build_seed


class Store:
    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(self.data_dir, 0o700)
        except OSError:
            pass
        self.path = self.data_dir / "db.json"
        self._lock_path = self.data_dir / ".db.lock"
        self._lock = threading.RLock()
        if not self.path.exists():
            self.reset()

    @contextmanager
    def _file_lock(self):
        """Inter-process lock for multi-worker or multi-instance deployments."""

        if fcntl is None:
            yield
            return
        handle = open(self._lock_path, "a+", encoding="utf-8")
        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            yield
        finally:
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            finally:
                handle.close()

    def _load(self) -> dict:
        with self.path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _save(self, data: dict) -> None:
        fd, tmp_name = tempfile.mkstemp(
            prefix="db-", suffix=".tmp", dir=str(self.data_dir)
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(
                    data,
                    handle,
                    ensure_ascii=False,
                    indent=2,
                    allow_nan=False,
                )
            try:
                os.chmod(tmp_name, 0o600)
            except OSError:
                pass
            os.replace(tmp_name, self.path)
        finally:
            if os.path.exists(tmp_name):
                try:
                    os.unlink(tmp_name)
                except OSError:
                    pass

    def read(self) -> dict:
        with self._lock:
            return copy.deepcopy(self._load())

    def update(self, mutator: Callable[[dict], Any]) -> Any:
        """Run `mutator(data)` under a lock, then persist if it returns."""

        with self._lock, self._file_lock():
            data = self._load()
            result = mutator(data)
            self._save(data)
            return result

    def reset(self, industry: str = "fnb") -> dict:
        with self._lock, self._file_lock():
            data = build_seed(industry)
            self._save(data)
            return copy.deepcopy(data)


def next_id(prefix: str, items: list[dict]) -> str:
    highest = 0
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    for item in items:
        match = pattern.match(str(item.get("id", "")))
        if match:
            highest = max(highest, int(match.group(1)))
    return f"{prefix}-{highest + 1:04d}"


def find_by_id(items: list[dict], item_id: str) -> dict | None:
    return next((item for item in items if item.get("id") == item_id), None)


def product_by_sku(products: list[dict], sku: str | None) -> dict | None:
    if not sku:
        return None
    return next((p for p in products if p.get("sku") == sku), None)
