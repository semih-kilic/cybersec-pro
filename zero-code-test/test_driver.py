#!/usr/bin/env python3
"""
Zero-code GUI parameter -> command coverage + real execution driver.

For every active tool (inventory183.json):
  A) dry-run : POST /api/v1/scan/start with agent_id=dryrun-harness and
               sentinel values SVAL_<field> for every non-target form field.
               PASS if the returned command string contains every sentinel.
  B) real-run: POST /api/v1/scans (no agent) with realistic values, poll
               GET /api/v1/scans/:id until terminal, cancel on budget expiry.

Rate-limit safe: each user (8 test users) is paced to <=5 start_scan calls/min.
Resume-safe: completed tools are skipped via results.jsonl.
"""
import json, time, os, sys, threading
from collections import deque
import urllib.request, urllib.error
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = "http://127.0.0.1:5001"
RESULT_FILE = os.path.join(HERE, "results.jsonl")

SLOW_BUDGET = 240
DEFAULT_BUDGET = 90
QUICK_BUDGET = 60

SLOW_TOOLS = {
    "amass", "nikto", "wapiti", "nuclei", "wpscan", "theharvester", "subfinder",
    "dirsearch", "gobuster", "dirb", "dnsrecon", "dnsenum", "sqlmap", "hydra",
    "medusa", "ncrack", "john", "hashcat", "msfvenom", "msfconsole", "recon-ng",
    "feroxbuster", "ffuf", "wfuzz", "joomscan", "davtest", "fimap", "sslyze",
    "sslscan", "wafw00f", "masscan", "rustscan", "uniscan", "dnsmap",
    "testssl.sh", "legion", "sparta", "dmitry", "dnsrecon", "metasploit",
}
QUICK_TOOLS = {
    "ettercap", "kismet", "wifite", "wifiphisher", "mitmproxy", "mitmweb",
    "responder", "photorec", "testdisk", "radare2", "rizin", "tcpdump",
    "tshark", "wireshark", "bettercap", "beef", "beef-xss", "armitage",
    "veil", "vncviewer", "xspy", "dbd", "spooftooph", "ike-scan",
}

TARGET_OVERRIDE = {
    "john": "5f4dcc3b5aa765d61d8327deb882cf99",
    "hashcat": "5f4dcc3b5aa765d61d8327deb882cf99",
    "md5sum": "/tmp/zt/testfile.txt",
    "sha1sum": "/tmp/zt/testfile.txt",
    "aircrack-ng": "/tmp/zt/test.cap",
    "cowpatty": "/tmp/zt/test.cap",
    "airdecap-ng": "/tmp/zt/test.cap",
    "mdk3": "eth0",
    "mdk4": "eth0",
    "reaver": "eth0",
    "bully": "eth0",
    "wifite": "eth0",
    "macchanger": "eth0",
    "airmon-ng": "eth0",
    "wash": "eth0",
    "besside-ng": "eth0",
    "kismet": "eth0",
    "tcpdump": "eth0",
    "tshark": "eth0",
    "ettercap": "eth0",
    "responder": "eth0",
    "samdump2": "/tmp/zt/SAM",
    "chntpw": "/tmp/zt/SAM",
    "regripper": "/tmp/zt/SYSTEM",
    "binwalk": "/tmp/zt/test.img",
    "foremost": "/tmp/zt/test.img",
    "bulk_extractor": "/tmp/zt/test.img",
    "dc3dd": "/tmp/zt/test.img",
    "testdisk": "/tmp/zt/test.img",
    "photorec": "/tmp/zt/test.img",
    "volatility": "/tmp/zt/test.img",
    "fcrackzip": "/tmp/zt/testfile.txt",
    "strings": "/tmp/zt/testfile.txt",
    "stegseek": "/tmp/zt/testfile.txt",
    "steghide": "/tmp/zt/testfile.txt",
    "exiftool": "/tmp/zt/testfile.txt",
    "radare2": "/tmp/zt/testfile.txt",
    "rizin": "/tmp/zt/testfile.txt",
    "msfvenom": "linux/x86/shell_reverse_tcp",
    "capa": "/tmp/zt/testfile.txt",
    "upx": "/tmp/zt/testfile.txt",
    "crtsh": "example.com",
    "maigret": "johndoe",
    "mobsf": "mobile",
}

# Per-tool real-run parameter overrides (environment-specific corrections).
PER_TOOL_PARAMS = {
    "hashcat": {"options": "--force"},
}

FIELD_VALUES = {
    "port_range": "80",
    "top_ports": "20",
    "os_detection": "-O",
    "service_version": "-sV",
    "script_scan": "-sC",
    "aggressive": "-A",
    "verbose": "-v",
    "no_dns": "-n",
    "wordlist": "/tmp/zt/wordlist.txt",
    "word_list": "/tmp/zt/wordlist.txt",
    "dictionary": "/tmp/zt/wordlist.txt",
    "hash": "5f4dcc3b5aa765d61d8327deb882cf99",
    "hash_file": "/tmp/zt/testhash.txt",
    "interface": "eth0",
    "iface": "eth0",
    "device": "eth0",
    "lhost": "127.0.0.1",
    "local_ip": "127.0.0.1",
    "lip": "127.0.0.1",
    "attacker_ip": "127.0.0.1",
    "callback_ip": "127.0.0.1",
    "rhost": "127.0.0.1",
    "lport": "8080",
    "listen_port": "8080",
    "threads": "4",
    "thread": "4",
    "jobs": "4",
    "concurrency": "4",
    "username": "admin",
    "user": "admin",
    "user_list": "/tmp/zt/wordlist.txt",
    "users": "/tmp/zt/wordlist.txt",
    "password": "password",
    "pass": "password",
    "pwd": "password",
    "output": "/tmp/zt/out",
    "out_dir": "/tmp/zt/out",
    "output_dir": "/tmp/zt/out",
    "outfile": "/tmp/zt/out.txt",
    "rate": "100",
    "timeout": "10",
    "command": "id",
    "cmd": "id",
    "email": "admin@example.com",
    "mail": "admin@example.com",
    "word": "password",
    "format": "text",
    "output_format": "text",
    "type": "txt",
    "session": "test",
    "url": "http://127.0.0.1:8088",
    "ip": "127.0.0.1",
    "domain": "example.com",
    "host": "127.0.0.1",
    "target": "127.0.0.1",
}

TARGET_ALIAS = {"target", "host", "url", "ip", "domain"}


def load():
    harness = json.load(open(os.path.join(HERE, "harness.json")))
    tools = json.load(open(os.path.join(HERE, "inventory183.json")))
    tokens = harness["tokens"]
    users = [u for u in harness["users"] if u in tokens]
    return harness, tools, users, tokens


def call(method, path, token, body=None, timeout=90):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Authorization", "Bearer " + token)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
            try:
                return r.status, json.loads(raw)
            except Exception:
                return r.status, {"raw": raw}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw, "error": raw[:400]}
    except Exception as e:
        return -1, {"error": str(e)}


class Pacer:
    def __init__(self):
        self.history = deque()
        self.lock = threading.Lock()

    def wait(self):
        while True:
            now = time.time()
            with self.lock:
                while self.history and now - self.history[0] > 60:
                    self.history.popleft()
                if len(self.history) < 5:
                    self.history.append(now)
                    return
            time.sleep(1.0)


def pick_target(tt, tpl, name):
    if name in TARGET_OVERRIDE:
        return TARGET_OVERRIDE[name]
    low = [t.lower() for t in (tt or [])]
    if "url" in low:
        return "http://127.0.0.1:8088"
    if "domain" in low:
        return "example.com"
    if "hash" in low:
        return "5f4dcc3b5aa765d61d8327deb882cf99"
    if any(k in low for k in ("file", "path", "image", "binary", "apk")):
        return "/tmp/zt/testfile.txt"
    return "127.0.0.1"


GENERIC_TOKENS = {"type", "format", "value", "name", "text", "list", "level", "size", "mode"}
EMPTY_TOKENS = {"options", "option", "args", "arguments", "arg", "extra", "flags", "flag", "command_options", "rules"}


def select_value(f):
    """Mimic the real frontend: <option value={opt.split(' ')[0]}>. Prefer default."""
    d = f.get("default")
    if d and str(d).strip():
        return str(d).strip()
    for o in f.get("options") or []:
        if isinstance(o, dict) and o.get("value"):
            return str(o["value"])
        if isinstance(o, str) and o.strip():
            return o.strip().split(" ")[0]
    return "1"


def real_field_value(f):
    """Mimic the GUI: an untouched form submits the field default. Only when the
    default is empty do we fall back to heuristics, so DB-designed defaults
    (e.g. 'LHOST=127.0.0.1', '-p 80,443') are preserved verbatim."""
    d = f.get("default")
    if d and str(d).strip():
        return str(d).strip()
    t = f.get("type", "text")
    if t == "select":
        return select_value(f)
    if t == "boolean":
        return "true"
    if t == "number":
        return "10"
    if t == "password":
        return "password"
    if t == "url":
        return "http://127.0.0.1:8088"
    name = (f.get("name") or "").lower()
    if name in FIELD_VALUES:
        return FIELD_VALUES[name]
    for k in sorted(FIELD_VALUES, key=len, reverse=True):
        if k in name and k not in GENERIC_TOKENS:
            return FIELD_VALUES[k]
    for e in EMPTY_TOKENS:
        if e in name:
            return ""
    return "1"


def budget_for(name):
    base = os.path.basename(name)
    if base in SLOW_TOOLS or name in SLOW_TOOLS:
        return SLOW_BUDGET
    if base in QUICK_TOOLS or name in QUICK_TOOLS:
        return QUICK_BUDGET
    return DEFAULT_BUDGET


def process_tool(tool, token, pacer, lock, results_seen, agent_id):
    name = tool["name"]
    if name in results_seen:
        return None
    rec = {"name": name, "category": tool.get("category", ""), "ts": time.time()}
    try:
        # ---- config ----
        q = urllib.parse.quote(tool["id"], safe="")
        st, cfg = call("GET", "/api/v1/tools/%s/config" % q, token, timeout=30)
        if st != 200:
            rec.update({"config_status": st, "dry_ok": False, "real_status": "config_error",
                        "error": cfg.get("error", "config fetch failed")})
            return rec
        tc = cfg.get("tool", {}) or {}
        params = tc.get("parameters") or {}
        form = params.get("form") or []
        if isinstance(form, dict):
            form = form.get("form", []) or []
        tt = params.get("target_types") or []
        tpl = tc.get("command_template") or ""

        target = pick_target(tt, tpl, name)
        non_target = [f for f in form if (f.get("name") or "").lower() not in TARGET_ALIAS]

        # ---- A) dry-run coverage ----
        dry_params = {}
        for f in form:
            fn = f.get("name") or ""
            if fn.lower() in TARGET_ALIAS:
                dry_params[fn] = target
            else:
                dry_params[fn] = "SVAL_" + fn
        pacer.wait()
        st, resp = call("POST", "/api/v1/scan/start", token, {
            "tool": name, "target": target, "parameters": dry_params,
            "agent_id": agent_id,
        })
        cmd = resp.get("command", "") if isinstance(resp, dict) else ""
        missing = []
        for f in non_target:
            fn = f.get("name") or ""
            if ("SVAL_" + fn) not in cmd:
                missing.append(fn)
        rec["dry_status"] = st
        rec["dry_command"] = cmd[:600]
        rec["dry_ok"] = (st in (200, 201)) and not missing
        rec["missing"] = missing
        rec["target"] = target

        # ---- B) real run ----
        real_params = {}
        for f in form:
            fn = f.get("name") or ""
            if fn.lower() in TARGET_ALIAS:
                real_params[fn] = target
            else:
                real_params[fn] = real_field_value(f)
        for k, v in PER_TOOL_PARAMS.get(name, {}).items():
            real_params[k] = v
        pacer.wait()
        st, resp = call("POST", "/api/v1/scans", token, {
            "tool": name, "target": target, "parameters": real_params,
        })
        if st not in (200, 201) or not (isinstance(resp, dict) and resp.get("scan_id")):
            rec["real_status"] = "submit_error"
            rec["error"] = resp.get("error", "submit failed") if isinstance(resp, dict) else str(resp)
            return rec
        scan_id = resp["scan_id"]
        rec["scan_id"] = scan_id
        rec["real_command"] = resp.get("command", "")[:600]

        budget = budget_for(name)
        t0 = time.time()
        status = "pending"
        out = err = ""
        while time.time() - t0 < budget:
            time.sleep(2)
            st, s = call("GET", "/api/v1/scans/" + scan_id, token, timeout=30)
            sc = (s or {}).get("scan", {}) if isinstance(s, dict) else {}
            status = sc.get("status", "pending")
            if status in ("completed", "failed", "cancelled", "timeout"):
                out = sc.get("output") or ""
                err = sc.get("error_log") or ""
                break
        if status in ("pending", "running"):
            call("POST", "/api/v1/scan/%s/stop" % scan_id, token, {})
            status = "cancelled-after-budget"
            _, s = call("GET", "/api/v1/scans/" + scan_id, token, timeout=30)
            sc = (s or {}).get("scan", {}) if isinstance(s, dict) else {}
            out = sc.get("output") or ""
            err = sc.get("error_log") or ""
        rec["real_status"] = status
        rec["elapsed_s"] = round(time.time() - t0, 1)
        rec["output_head"] = out[:400]
        rec["error_log"] = err[:400]
        return rec
    except Exception as e:
        rec.update({"dry_ok": False, "real_status": "exception", "error": str(e)})
        return rec


def main():
    harness, tools, users, tokens = load()
    agent_id = harness.get("agent_id")
    workers = int(os.environ.get("ZT_WORKERS", "8"))
    only = os.environ.get("ZT_TOOLS", "").strip()
    if only:
        names = {n.strip() for n in only.split(",") if n.strip()}
        tools = [t for t in tools if t["name"] in names]

    results_seen = set()
    if os.path.exists(RESULT_FILE):
        for line in open(RESULT_FILE):
            try:
                results_seen.add(json.loads(line)["name"])
            except Exception:
                pass

    lock = threading.Lock()
    idx = [0]
    counters = {"done": 0, "dry_pass": 0, "completed": 0}

    def worker(uid):
        pacer = Pacer()
        token = tokens[uid]
        while True:
            with lock:
                if idx[0] >= len(tools):
                    return
                tool = tools[idx[0]]
                idx[0] += 1
            rec = process_tool(tool, token, pacer, lock, results_seen, agent_id)
            if rec is None:
                continue
            with lock:
                counters["done"] += 1
                if rec.get("dry_ok"):
                    counters["dry_pass"] += 1
                if rec.get("real_status") == "completed":
                    counters["completed"] += 1
                with open(RESULT_FILE, "a") as f:
                    f.write(json.dumps(rec) + "\n")
                if counters["done"] % 5 == 0:
                    print("progress: done=%d/%d dry_pass=%d completed=%d last=%s real=%s" % (
                        counters["done"], len(tools), counters["dry_pass"],
                        counters["completed"], rec["name"], rec.get("real_status")), flush=True)

    threads = []
    for uid in users[:workers]:
        t = threading.Thread(target=worker, args=(uid,), daemon=True)
        t.start()
        threads.append(t)
    for t in threads:
        t.join()

    # ---- summary ----
    rows = []
    for line in open(RESULT_FILE):
        try:
            rows.append(json.loads(line))
        except Exception:
            pass
    total = len(rows)
    dry_fail = [r for r in rows if not r.get("dry_ok")]
    real_status = {}
    for r in rows:
        real_status[r.get("real_status", "?")] = real_status.get(r.get("real_status", "?"), 0) + 1
    print("=" * 60)
    print("TOTAL processed: %d" % total)
    print("DRY-RUN coverage PASS: %d  FAIL: %d" % (total - len(dry_fail), len(dry_fail)))
    print("REAL-RUN statuses: %s" % json.dumps(real_status, sort_keys=True))
    if dry_fail:
        print("-" * 60)
        print("DRY-RUN FAILURES:")
        for r in dry_fail:
            print("  %s | st=%s | missing=%s | cmd=%s" % (
                r["name"], r.get("dry_status"), r.get("missing"), r.get("dry_command", "")[:200]))


if __name__ == "__main__":
    main()
