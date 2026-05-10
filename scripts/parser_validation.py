#!/usr/bin/env python3
"""Track B: Real scan parser validation.

Launches scans for a curated set of tools against benign targets,
polls until completion, and asserts that `findings` JSON in the
returned scan result is well-formed (non-null, has the expected
top-level shape produced by the dedicated parser — NOT the generic
`{summary, raw_lines}` fallback).

Output: writes /tmp/parser_validation.json with PASS/FAIL per tool.
"""
from __future__ import annotations
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:5001/api/v1")
EMAIL = os.environ.get("SMOKE_EMAIL", "testdev@cybersec.test")
PASSWORD = os.environ.get("SMOKE_PASSWORD", "TestPass123!")
POLL_TIMEOUT = int(os.environ.get("POLL_TIMEOUT", "90"))
POLL_INTERVAL = 3

# (tool_id, target, expected_findings_keys, scan_type)
# expected_findings_keys: at least ONE of these must be present in
# findings JSON to count as a real-parser hit (vs generic fallback).
CASES = [
    ("nmap",       "scanme.nmap.org",        ["hosts", "open_ports", "ports"], "quick"),
    ("nuclei",     "http://scanme.nmap.org", ["vulnerabilities", "findings"],  "quick"),
    ("whatweb",    "http://scanme.nmap.org", ["technologies", "fingerprints"], "quick"),
    ("httpx",      "http://scanme.nmap.org", ["urls", "technologies", "results"], "quick"),
    ("subfinder",  "nmap.org",               ["subdomains", "results"],        "quick"),
    ("dig",        "scanme.nmap.org",        ["records", "subdomains", "results"], "quick"),
    ("nikto",      "http://scanme.nmap.org", ["vulnerabilities", "findings"],  "quick"),
    ("sslscan",    "scanme.nmap.org",        ["ciphers", "certificate", "ssl"], "quick"),
    ("gitleaks",   "/home/cybersec/cybersec-pro", ["secrets", "findings"],      "quick"),
    ("tfsec",      "/home/cybersec/cybersec-pro", ["iac_findings", "findings"], "quick"),
    ("trivy",      "/home/cybersec/cybersec-pro", ["vulnerabilities", "findings"], "quick"),
]


def http_json(method: str, path: str, body=None, token: str | None = None, timeout=20):
    url = f"{BASE}{path}" if path.startswith("/") else path
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"_raw": raw}


def get_token() -> str:
    r = http_json("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD})
    tok = r.get("access_token") or r.get("token")
    if tok:
        return tok
    r = http_json("POST", "/auth/register", {
        "email": EMAIL, "password": PASSWORD,
        "first_name": "Smoke", "last_name": "User",
    })
    tok = r.get("access_token") or r.get("token")
    if not tok:
        raise SystemExit(f"could not auth: {r}")
    return tok


def run_case(tok: str, tool: str, target: str, expected: list[str], scan_type: str) -> dict:
    started = http_json("POST", "/scan/start", {
        "tool_id": tool, "target": target, "scan_type": scan_type,
    }, token=tok)
    scan_id = started.get("scan_id") or (started.get("scan") or {}).get("id")
    if not scan_id:
        return {
            "tool": tool, "target": target, "ok": False,
            "reason": "start_failed", "response": started,
        }

    deadline = time.time() + POLL_TIMEOUT
    last = {}
    status = "unknown"
    while time.time() < deadline:
        last = http_json("GET", f"/scan/{scan_id}/result", token=tok)
        scan = last.get("scan", last) if isinstance(last, dict) else {}
        status = scan.get("status") or last.get("status") or "unknown"
        if status in ("completed", "failed", "stopped", "cancelled", "error"):
            break
        time.sleep(POLL_INTERVAL)

    scan = last.get("scan", last) if isinstance(last, dict) else {}
    findings = scan.get("findings") or last.get("findings")
    if isinstance(findings, str):
        try:
            findings = json.loads(findings)
        except Exception:
            pass

    keys = list(findings.keys()) if isinstance(findings, dict) else []
    matched = [k for k in expected if k in keys]
    is_generic = isinstance(findings, dict) and set(keys) <= {"summary", "raw_lines"}
    ok = bool(matched) and not is_generic

    # Stop / cleanup
    try:
        http_json("POST", f"/scan/{scan_id}/stop", {}, token=tok, timeout=5)
    except Exception:
        pass

    return {
        "tool": tool, "target": target, "scan_id": scan_id,
        "status": status, "ok": ok,
        "matched_keys": matched,
        "findings_keys": keys[:20],
        "is_generic_fallback": is_generic,
        "expected_any": expected,
    }


def main():
    tok = get_token()
    print(f"auth ok, running {len(CASES)} cases against {BASE}")
    results = []
    for tool, tgt, exp, st in CASES:
        print(f"  -> {tool:<12} target={tgt}")
        sys.stdout.flush()
        try:
            r = run_case(tok, tool, tgt, exp, st)
        except Exception as e:
            r = {"tool": tool, "target": tgt, "ok": False, "exception": str(e)}
        results.append(r)
        flag = "PASS" if r.get("ok") else "FAIL"
        print(f"     {flag} status={r.get('status')} keys={r.get('findings_keys')} matched={r.get('matched_keys')}")
        sys.stdout.flush()

    out = {
        "base_url": BASE,
        "total": len(results),
        "passed": sum(1 for r in results if r.get("ok")),
        "failed": sum(1 for r in results if not r.get("ok")),
        "results": results,
    }
    with open("/tmp/parser_validation.json", "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nSummary: {out['passed']}/{out['total']} passed")
    print("Wrote /tmp/parser_validation.json")
    return 0 if out["failed"] == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
