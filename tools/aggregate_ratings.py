#!/usr/bin/env python3
"""Aggregate public GitHub skill-rating issues into registry.json.

One GitHub account contributes the latest valid issue per skill. The issue remains
the audit trail; this script only writes the derived average and count.
"""

from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "registry.json"


def github_json(url: str) -> object:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def field(body: str, name: str) -> str:
    match = re.search(rf"^###\s+{re.escape(name)}\s*\n+\s*(.+?)\s*(?=\n###|\Z)", body or "", re.MULTILINE | re.DOTALL)
    return match.group(1).strip() if match else ""


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def main() -> None:
    repository = os.environ["GITHUB_REPOSITORY"]
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8-sig"))
    known = {skill["id"] for skill in registry["skills"]}
    latest: dict[tuple[str, str], tuple[datetime, int]] = {}
    page = 1
    while True:
        query = urllib.parse.urlencode({"state": "all", "labels": "skill-rating", "per_page": 100, "page": page})
        issues = github_json(f"https://api.github.com/repos/{repository}/issues?{query}")
        if not issues:
            break
        for issue in issues:
            if "pull_request" in issue:
                continue
            skill_id = field(issue.get("body", ""), "Skill ID")
            try:
                rating = int(field(issue.get("body", ""), "评分"))
            except ValueError:
                continue
            if skill_id not in known or rating not in range(1, 6):
                continue
            key = (issue.get("user", {}).get("login", "anonymous"), skill_id)
            candidate = (parse_time(issue.get("updated_at") or issue["created_at"]), rating)
            if key not in latest or candidate[0] > latest[key][0]:
                latest[key] = candidate
        if len(issues) < 100:
            break
        page += 1

    for skill in registry["skills"]:
        ratings = [rating for (user, skill_id), (_, rating) in latest.items() if skill_id == skill["id"]]
        skill["rating"] = {
            "average": round(sum(ratings) / len(ratings), 2) if ratings else 0.0,
            "count": len(ratings),
        }

    REGISTRY_PATH.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Aggregated {len(latest)} public ratings into {len(registry['skills'])} skills")


if __name__ == "__main__":
    main()
