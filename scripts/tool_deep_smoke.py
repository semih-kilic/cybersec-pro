#!/usr/bin/env python3
"""
Deep tool smoke test — actually execute each active tool with a benign
introspection flag (--help, -h, --version) under a strict timeout, capture
exit code + first lines of stdout/stderr, and persist the result so the UI
can show a real "passes self-test" badge.

Strategy per tool:
  1. Resolve binary (binary_name → first template token → tool name).
  2. Try probes in order: ["--help", "-h", "--version", "version"].
     The first probe that returns within timeout AND produces ANY output OR
     exits with code 0/1/2 is treated as healthy. (Many CLIs exit 1 on
     --help, that's fine — we're proving the binary loads.)
  3. Tools that require interactive stdin or open a TUI will time out;
     those are recorded as `needs_interactive` (still active, but UI can
     warn the user that it can't run unattended).

DB columns updated:
  health_status      → 'healthy' | 'needs_interactive' | 'crashed' | 'missing'
  health_exit_code   → int (probe exit code, NULL on timeout)
  health_evidence    → first 800 chars of combined stdout+stderr
  health_probe       → which probe argument worked
  last_health_check  → now()

Usage:
  python3 tool_deep_smoke.py [--apply] [--workers 8] [--timeout 6]
                             [--limit N] [--only NAME[,NAME,...]]
"""
from __future__ import annotations
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import psycopg2  # type: ignore
import psycopg2.extras  # type: ignore

DB_DSN = os.environ.get(
    "DATABASE_URL",
    "host=/var/run/postgresql dbname=cybersec_pro user=cybersec",
)

PROBES = ["--help", "-h", "--version", "version"]
INTERPRETER_WRAPPERS = {"bash", "sh", "python3", "python", "ruby", "perl", "go", "node"}
RELPATH_SEARCH_ROOTS = [
    "/opt/cybersec-tools", "/opt", "/usr/share", "/usr/local/share",
    "/usr/share/kali-menu", "/home/cybersec/cybersec-tools",
]

# Some tools must NEVER be probed automatically (destructive, blocking).
SKIP_PROBE = {
    "shutdown", "reboot", "poweroff", "halt",
    "msfconsole",   # opens TUI even with --help in some setups
    "wireshark", "ettercap-graphical", "burpsuite", "zaproxy",
    "ghidra", "radare2-cutter", "armitage",
}


def resolve_binary(name: str, binary_name: str | None,
                   template: str | None) -> tuple[str | None, str]:
    """Return (resolved_path_or_arg, mode). mode: 'bin' or 'script'."""
    binary_name = (binary_name or "").strip() or name
    found = shutil.which(binary_name)
    if found:
        return found, "bin"

    template = (template or "").strip()
    if template:
        toks = template.split()
        if toks:
            first = toks[0]
            if first in INTERPRETER_WRAPPERS and len(toks) > 1:
                interp = shutil.which(first)
                second = toks[1]
                if second.startswith("/") and Path(second).exists():
                    return f"{interp} {second}", "script"
                if "/" in second and not second.startswith("-"):
                    for root in RELPATH_SEARCH_ROOTS:
                        cand = Path(root) / second
                        if cand.exists():
                            return f"{interp} {cand}", "script"
            elif first.startswith("/") and Path(first).exists():
                return first, "bin"
            elif not first.startswith("{"):
                f = shutil.which(first)
                if f:
                    return f, "bin"

    found = shutil.which(name)
    if found:
        return found, "bin"
    return None, "missing"


def run_probe(cmd: list[str], timeout: float) -> tuple[int | None, str]:
    try:
        p = subprocess.run(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            text=True,
            errors="replace",
        )
        return p.returncode, (p.stdout or "")[:800]
    except subprocess.TimeoutExpired as e:
        partial = ""
        if e.stdout:
            partial = (e.stdout if isinstance(e.stdout, str)
                       else e.stdout.decode("utf-8", "replace"))[:800]
        return None, partial
    except FileNotFoundError:
        return -1, "FileNotFoundError"
    except Exception as ex:  # noqa: BLE001
        return -2, f"{type(ex).__name__}: {ex}"[:800]


def evaluate(tool: dict, timeout: float) -> dict:
    name = tool["name"]
    if name.lower() in SKIP_PROBE:
        return {**tool, "health_status": "skipped",
                "health_exit_code": None, "health_evidence": "in SKIP_PROBE",
                "health_probe": None}

    resolved, mode = resolve_binary(name, tool.get("binary_name"),
                                    tool.get("command_template"))
    if not resolved:
        return {**tool, "health_status": "missing",
                "health_exit_code": None,
                "health_evidence": f"binary_name={tool.get('binary_name')}",
                "health_probe": None}

    base_cmd = resolved.split() if mode == "script" else [resolved]

    last_evidence = ""
    last_code = None
    last_probe = None
    for probe in PROBES:
        code, output = run_probe(base_cmd + [probe], timeout)
        last_code, last_evidence, last_probe = code, output, probe
        if code is None:
            # timeout — try next probe
            continue
        if code in (0, 1, 2) or (output and len(output.strip()) > 4):
            # Loaded and produced output (or sane exit) → healthy
            return {**tool, "health_status": "healthy",
                    "health_exit_code": code,
                    "health_evidence": output.strip()[:800],
                    "health_probe": probe}
        # any other exit → try next probe

    if last_code is None:
        status = "needs_interactive"
    elif last_code < 0:
        status = "crashed"
    else:
        status = "healthy" if last_evidence.strip() else "crashed"

    return {**tool, "health_status": status,
            "health_exit_code": last_code,
            "health_evidence": (last_evidence or "")[:800],
            "health_probe": last_probe}


def fetch_tools(only: list[str] | None, limit: int | None) -> list[dict]:
    conn = psycopg2.connect(DB_DSN)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sql = ("SELECT id, name, binary_name, command_template "
                   "FROM tools WHERE is_active = TRUE")
            params: list = []
            if only:
                sql += " AND name = ANY(%s)"
                params.append(only)
            sql += " ORDER BY name"
            if limit:
                sql += " LIMIT %s"
                params.append(limit)
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def write_results(results: list[dict]):
    conn = psycopg2.connect(DB_DSN)
    try:
        with conn.cursor() as cur:
            for r in results:
                cur.execute(
                    """
                    UPDATE tools SET
                        health_status     = %s,
                        health_exit_code  = %s,
                        health_evidence   = %s,
                        health_probe      = %s,
                        last_health_check = NOW()
                    WHERE id = %s
                    """,
                    (r["health_status"], r["health_exit_code"],
                     r["health_evidence"], r["health_probe"], r["id"]),
                )
        conn.commit()
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="Persist results to DB.")
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--timeout", type=float, default=6.0,
                    help="Per-probe timeout (sec).")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--only", default=None,
                    help="Comma-separated tool names to test.")
    ap.add_argument("--out", default="/home/cybersec/tool_deep_smoke.json")
    args = ap.parse_args()

    only = [s.strip() for s in args.only.split(",")] if args.only else None
    tools = fetch_tools(only, args.limit)
    print(f"Probing {len(tools)} tools "
          f"(workers={args.workers}, timeout={args.timeout}s)")
    t0 = time.time()

    results: list[dict] = []
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(evaluate, t, args.timeout): t for t in tools}
        done = 0
        for fut in as_completed(futs):
            results.append(fut.result())
            done += 1
            if done % 50 == 0 or done == len(tools):
                print(f"  {done}/{len(tools)}   elapsed={time.time()-t0:0.1f}s")

    from collections import Counter
    by_status = Counter(r["health_status"] for r in results)
    print("\n=== Summary ===")
    for k, v in sorted(by_status.items(), key=lambda x: -x[1]):
        print(f"  {k:20s} {v}")
    print(f"Total: {len(results)}   time: {time.time()-t0:0.1f}s")

    Path(args.out).write_text(json.dumps(results, indent=2, default=str))
    print(f"Wrote {args.out}")

    if args.apply:
        write_results(results)
        print("DB updated (health_status, health_evidence, last_health_check).")


if __name__ == "__main__":
    main()
