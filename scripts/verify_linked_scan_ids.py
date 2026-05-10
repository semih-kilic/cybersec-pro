#!/usr/bin/env python3
"""Verify Roadmap #4: linked_scan_ids enrichment on purple-team progress."""
import json, os, sys, time, urllib.request, urllib.error

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:5001/api/v1")
EMAIL = os.environ.get("SMOKE_EMAIL", "testdev@cybersec.test")
PASSWORD = os.environ.get("SMOKE_PASSWORD", "TestPass123!")
TARGET = os.environ.get("PT_TARGET", "scanme.nmap.org")
CHAIN = os.environ.get("PT_CHAIN", "chain-credential-access")


def http(method, path, body=None, token=None, timeout=20):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
            code = r.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        code = e.code
    try:
        return code, json.loads(raw)
    except json.JSONDecodeError:
        return code, {"_raw": raw}


def main():
    _, r = http("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD})
    tok = r.get("access_token") or r.get("token")
    if not tok:
        print("auth failed:", r); return 2
    print(f"auth ok, target={TARGET} chain={CHAIN}")

    code, r = http("POST", "/purple-team/exercises", {"chain_id": CHAIN, "target": TARGET}, token=tok)
    if code not in (200, 201):
        print("create failed:", code, r); return 2
    ex_id = r.get("id")
    print(f"created exercise id={ex_id} status={r.get('status')}")

    code, r = http("GET", f"/purple-team/exercises/{ex_id}", token=tok)
    print(f"  tick1 status={r.get('status')} linked_scan_ids={r.get('linked_scan_ids')}")

    print("waiting 95s for completion...")
    time.sleep(95)

    code, r = http("GET", f"/purple-team/exercises/{ex_id}", token=tok)
    linked = r.get("linked_scan_ids")
    print(f"  tick2 status={r.get('status')} linked_scan_ids={linked}")
    out = {
        "exercise_id": ex_id,
        "final_status": r.get("status"),
        "linked_scan_ids": linked,
        "linked_count": len(linked) if isinstance(linked, list) else None,
        "ok": isinstance(linked, list),
    }
    with open("/tmp/linked_scan_ids_verify.json", "w") as f:
        json.dump(out, f, indent=2)
    print(json.dumps(out, indent=2))
    return 0 if out["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
