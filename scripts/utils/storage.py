import json
import os
from pathlib import Path


class JSONStorage:
    """Utility for reading/writing JSON data files."""

    def __init__(self, base_dir: str = "../data"):
        self.base_dir = Path(base_dir)

    def read(self, path: str):
        full_path = self.base_dir / path
        if not full_path.exists():
            return None
        with open(full_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def write(self, path: str, data) -> None:
        full_path = self.base_dir / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def append(self, path: str, new_item, key: str = "id") -> list:
        """Append to a JSON array file, deduplicating by `key`."""
        existing = self.read(path) or []
        if isinstance(existing, list):
            ids = {item.get(key) for item in existing if item.get(key)}
            if new_item.get(key) not in ids:
                existing.append(new_item)
            return existing
        return existing
