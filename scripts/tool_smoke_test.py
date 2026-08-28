#!/usr/bin/env python3
"""
Tool smoke test — for every active tool in the DB, decide whether its primary
binary is reachable on this host. The result is written to JSON and used to
update is_active in the tools table so the UI only ever surfaces tools that
will actually run.

Resolution order for each tool:
  1. binary_name (DB column)        → `which <binary_name>`
  2. first whitespace token of command_template (resolving `bash X/y.sh` → X/y.sh)
  3. tool name itself

Tools whose template starts with `bash <repo>/` or `python3 <repo>/` (relative
path) are checked against /opt/cybersec-tools/<repo>/, /opt/<repo>/,
/usr/share/<repo>/, and /usr/share/kali-menu/.

Output:
  /home/cybersec/tool_smoke_results.json — { working: [...], broken: [...] }
  Optionally with --apply: updates DB (is_active=FALSE for broken tools).
"""
from __future__ import annotations
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import psycopg2  # type: ignore

# AUDIT 2026-08-28: the production Postgres password used to be hardcoded here
# and was committed to git. Credentials now come from the environment only.
DB_URL = os.environ.get("DATABASE_URL") or (
    "postgres://cybersec:{pw}@localhost:5432/cybersec_pro".format(
        pw=os.environ.get("DB_PASSWORD", "")
    )
)

# Probable install roots for third-party scripts shipped with relative paths.
RELPATH_SEARCH_ROOTS = [
    "/opt/cybersec-tools",
    "/opt",
    "/usr/share",
    "/usr/local/share",
    "/usr/share/kali-menu",
    "/home/cybersec/cybersec-tools",
]

# Binaries that are de-facto always present on Kali but `which` may miss
# because they're shell builtins or aliased.
ALWAYS_PRESENT = {"echo", "ls", "cat", "grep", "awk", "sed", "true", "false"}

# Wrappers — if these are present, the wrapped script is reachable.
INTERPRETER_WRAPPERS = {"bash", "sh", "python3", "python", "ruby", "perl", "go", "node"}


def which(binary: str) -> str | None:
    if not binary:
        return None
    if binary in ALWAYS_PRESENT:
        return f"/builtin/{binary}"
    return shutil.which(binary)


def resolve_relative_script(token: str) -> str | None:
    """Try to find `<repo>/<script>` in any known install root."""
    if "/" not in token:
        return None
    for root in RELPATH_SEARCH_ROOTS:
        candidate = Path(root) / token
        if candidate.exists():
            return str(candidate)
    return None


def evaluate_tool(tool_id: str, name: str, binary_name: str, template: str) -> dict:
    """Return {status: working|broken, reason: str, evidence: str}."""
    template = (template or "").strip()
    binary_name = (binary_name or name).strip()

    # 1. Primary binary check
    found = which(binary_name)
    if found:
        return {
            "id": tool_id, "name": name, "status": "working",
            "reason": "binary_in_path", "evidence": found,
        }

    # 2. Inspect command_template tokens
    if template:
        # First token after stripping any sudo prefix
        tokens = template.split()
        if not tokens:
            return {"id": tool_id, "name": name, "status": "broken",
                    "reason": "empty_template", "evidence": ""}

        first = tokens[0]
        rest = tokens[1:] if len(tokens) > 1 else []

        # Case A: bash X/y.sh  /  python3 X/y.py  → check second token's resolved path
        if first in INTERPRETER_WRAPPERS and rest:
            interp = which(first)
            if interp is None:
                return {"id": tool_id, "name": name, "status": "broken",
                        "reason": "interpreter_missing", "evidence": first}
            script_token = rest[0]
            if "/" in script_token and not script_token.startswith("/"):
                resolved = resolve_relative_script(script_token)
                if resolved:
                    return {"id": tool_id, "name": name, "status": "working",
                            "reason": "script_found", "evidence": resolved}
                return {"id": tool_id, "name": name, "status": "broken",
                        "reason": "script_not_found", "evidence": script_token}
            # Absolute script path
            if script_token.startswith("/"):
                if Path(script_token).exists():
                    return {"id": tool_id, "name": name, "status": "working",
                            "reason": "script_found", "evidence": script_token}
                return {"id": tool_id, "name": name, "status": "broken",
                        "reason": "script_not_found", "evidence": script_token}
            # Inline interpreter call (e.g. python3 -c "...")
            if script_token.startswith("-"):
                return {"id": tool_id, "name": name, "status": "working",
                        "reason": "interpreter_inline", "evidence": " ".join(tokens[:3])}

        # Case B: absolute path to binary
        if first.startswith("/"):
            if Path(first).exists():
                return {"id": tool_id, "name": name, "status": "working",
                        "reason": "absolute_path_exists", "evidence": first}
            return {"id": tool_id, "name": name, "status": "broken",
                    "reason": "absolute_path_missing", "evidence": first}

        # Case C: plain binary in template
        if not first.startswith("{"):
            found = which(first)
            if found:
                return {"id": tool_id, "name": name, "status": "working",
                        "reason": "template_binary_in_path", "evidence": found}

    # 3. Last resort — tool name as binary
    found = which(name)
    if found:
        return {"id": tool_id, "name": name, "status": "working",
                "reason": "name_in_path", "evidence": found}

    return {"id": tool_id, "name": name, "status": "broken",
            "reason": "binary_not_found",
            "evidence": f"binary_name={binary_name} template={template[:80]}"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="Update is_active=FALSE for broken tools in the DB.")
    ap.add_argument("--out", default="/home/cybersec/tool_smoke_results.json")
    args = ap.parse_args()

    conn = psycopg2.connect(DB_URL)
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, name, COALESCE(binary_name, name), COALESCE(command_template, '')
              FROM tools
             WHERE is_active = TRUE
             ORDER BY name
        """)
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    results = [evaluate_tool(*r) for r in rows]
    working = [r for r in results if r["status"] == "working"]
    broken = [r for r in results if r["status"] == "broken"]

    # Reason histogram for visibility
    from collections import Counter
    work_reasons = Counter(r["reason"] for r in working)
    broken_reasons = Counter(r["reason"] for r in broken)

    summary = {
        "total": len(results),
        "working_count": len(working),
        "broken_count": len(broken),
        "work_reasons": dict(work_reasons),
        "broken_reasons": dict(broken_reasons),
        "working": working,
        "broken": broken,
    }

    Path(args.out).write_text(json.dumps(summary, indent=2))
    print(f"Total: {len(results)}  Working: {len(working)}  Broken: {len(broken)}")
    print("Working reasons:", dict(work_reasons))
    print("Broken reasons:", dict(broken_reasons))
    print(f"Wrote: {args.out}")

    if args.apply and broken:
        broken_ids = [r["id"] for r in broken]
        conn = psycopg2.connect(DB_URL)
        try:
            cur = conn.cursor()
            cur.execute(
                "UPDATE tools SET is_active = FALSE WHERE id = ANY(%s)",
                (broken_ids,),
            )
            updated = cur.rowcount
            conn.commit()
            cur.close()
            print(f"Marked {updated} broken tools as is_active=FALSE.")
        finally:
            conn.close()


if __name__ == "__main__":
    main()
