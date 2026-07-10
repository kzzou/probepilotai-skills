#!/usr/bin/env python3
"""Aggregate anonymous ratings exported by the rating API into registry.json.

The API already stores one row per (anonymous device, skill). The hash is used
only as a deduplication key and is never written to the public registry.
"""

from __future__ import annotations

import json
import os
import urllib.request
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "registry.json"


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def fetch_export() -> list[dict]:
    url = os.environ.get("RATINGS_API_EXPORT_URL", "").strip()
    token = os.environ.get("RATINGS_API_TOKEN", "").strip()
    if not url or not token:
        raise RuntimeError("RATINGS_API_EXPORT_URL 和 RATINGS_API_TOKEN 必须配置")
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "ProbePilotAI-Skill-Rating-Aggregator/1.0 (+https://github.com/kzzou/probepilotai-skills)",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if payload.get("ok") is not True or not isinstance(payload.get("ratings"), list):
        raise RuntimeError("匿名评分 API 返回格式无效")
    return payload["ratings"]


def main() -> None:
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8-sig"))
    known = {skill["id"] for skill in registry["skills"]}
    latest: dict[tuple[str, str], tuple[datetime, int]] = {}
    for item in fetch_export():
        skill_id = item.get("skill_id")
        voter_hash = item.get("voter_hash")
        rating = item.get("rating")
        updated_at = item.get("updated_at")
        if skill_id not in known or not isinstance(voter_hash, str) or not voter_hash:
            continue
        if not isinstance(rating, int) or rating not in range(1, 6) or not updated_at:
            continue
        candidate = (parse_time(updated_at), rating)
        key = (voter_hash, skill_id)
        if key not in latest or candidate[0] > latest[key][0]:
            latest[key] = candidate

    for skill in registry["skills"]:
        ratings = [rating for (voter, skill_id), (_, rating) in latest.items() if skill_id == skill["id"]]
        skill["rating"] = {
            "average": round(sum(ratings) / len(ratings), 2) if ratings else 0.0,
            "count": len(ratings),
        }

    registry["generated_at"] = datetime.now().astimezone().isoformat()
    REGISTRY_PATH.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Aggregated {len(latest)} anonymous ratings into {len(registry['skills'])} skills")


if __name__ == "__main__":
    main()
