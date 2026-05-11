#!/usr/bin/env python3
"""Tool health probe runner.

For every row in `tools`, attempt to verify the binary exists and responds.
Updates: health_status ('ok'|'missing'|'broken'|'timeout'|'skipped'),
         health_exit_code, health_evidence (truncated stderr/stdout),
         last_health_check.

Usage: sudo -u postgres python3 tool-health-probe.py
       (or pass DSN via PG_DSN env var)
"""
import os, sys, json, time, shutil, subprocess, signal
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("psycopg2 missing — apt install python3-psycopg2", file=sys.stderr)
    sys.exit(1)

DSN = os.environ.get("PG_DSN", "dbname=cybersec_pro")
TIMEOUT = int(os.environ.get("PROBE_TIMEOUT", "8"))
PROBE_FLAGS = ["--version", "-V", "-v", "--help", "-h"]
EVIDENCE_MAX = 400
TUI_DENYLIST = {
    "vim", "vi", "nvim", "less", "more", "mc", "tmux", "screen", "htop", "top",
    "nano", "joe", "emacs", "ne", "pico", "mutt", "ranger", "tig", "lynx", "links",
    "elinks", "w3m", "irssi", "weechat", "btop",
}
REPORT_PATH = os.environ.get(
    "REPORT_PATH",
    f"/home/cybersec/cybersec-pro/scripts/tool-health-report-{datetime.now().strftime('%Y%m%d-%H%M')}.json",
)


def truncate(s: str) -> str:
    s = (s or "").strip()
    return s if len(s) <= EVIDENCE_MAX else s[:EVIDENCE_MAX] + "...[trunc]"


def probe_binary(binary_name: str, custom_probe: str | None) -> dict:
    """Return dict with status, exit_code, evidence."""
    if not binary_name:
        return {"status": "skipped", "exit_code": None, "evidence": "no binary_name"}
    if binary_name.lower() in TUI_DENYLIST:
        return {"status": "skipped", "exit_code": None, "evidence": "TUI binary (denylisted)"}

    # Prefer custom probe (full command line) if provided
    if custom_probe and custom_probe.strip():
        try:
            r = subprocess.run(
                custom_probe, shell=True, capture_output=True, timeout=TIMEOUT, text=True,
                stdin=subprocess.DEVNULL, start_new_session=True,
                env={**os.environ, "TERM": "dumb", "NO_COLOR": "1", "PAGER": "cat"},
            )
            ev = truncate(r.stdout or r.stderr)
            status = "ok" if r.returncode == 0 else "broken"
            return {"status": status, "exit_code": r.returncode, "evidence": ev}
        except subprocess.TimeoutExpired:
            return {"status": "timeout", "exit_code": None, "evidence": f"timeout {TIMEOUT}s"}
        except Exception as e:
            return {"status": "broken", "exit_code": None, "evidence": truncate(str(e))}

    # Resolve binary
    bin_path = shutil.which(binary_name)
    if not bin_path:
        # Some entries are shell helpers in /usr/share/* — try common paths
        for prefix in ("/usr/bin/", "/usr/sbin/", "/usr/local/bin/", "/opt/"):
            cand = prefix + binary_name
            if os.path.isfile(cand) and os.access(cand, os.X_OK):
                bin_path = cand
                break
        if not bin_path:
            return {"status": "missing", "exit_code": 127, "evidence": f"which({binary_name}) not found"}

    last_err = ""
    for flag in PROBE_FLAGS:
        try:
            r = subprocess.run(
                [bin_path, flag], capture_output=True, timeout=TIMEOUT, text=True,
                stdin=subprocess.DEVNULL, start_new_session=True,
                env={**os.environ, "TERM": "dumb", "NO_COLOR": "1", "PAGER": "cat"},
            )
        except subprocess.TimeoutExpired:
            last_err = f"timeout({flag})"
            continue
        except Exception as e:
            last_err = f"err({flag}): {e}"
            continue

        ev = truncate(r.stdout or r.stderr)
        # Many CLI tools return non-zero on --help; accept any output as evidence
        if r.returncode in (0, 1, 2) and (r.stdout or r.stderr):
            return {"status": "ok", "exit_code": r.returncode, "evidence": ev}
        last_err = f"{flag}->rc={r.returncode}"

    return {"status": "broken", "exit_code": None, "evidence": truncate(last_err)}


def main() -> int:
    conn = psycopg2.connect(DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute(
        "SELECT id, name, binary_name, health_probe FROM tools "
        "WHERE binary_name IS NOT NULL AND binary_name <> '' "
        "AND (last_health_check IS NULL "
        "     OR last_health_check < NOW() - INTERVAL '24 hours') "
        "ORDER BY name"
    )
    rows = cur.fetchall()
    total = len(rows)
    print(f"[probe] {total} tools to check (timeout={TIMEOUT}s)")

    summary = {"ok": 0, "missing": 0, "broken": 0, "timeout": 0, "skipped": 0}
    detailed = []
    started = time.time()

    upd = conn.cursor()
    workers = int(os.environ.get("PROBE_WORKERS", "8"))
    print(f"[probe] using {workers} parallel workers")

    with ThreadPoolExecutor(max_workers=workers) as pool:
        future_to_row = {
            pool.submit(probe_binary, r["binary_name"], r.get("health_probe")): r
            for r in rows
        }
        for idx, fut in enumerate(as_completed(future_to_row), 1):
            row = future_to_row[fut]
            try:
                result = fut.result()
            except Exception as e:
                result = {"status": "broken", "exit_code": None, "evidence": truncate(str(e))}
            summary[result["status"]] = summary.get(result["status"], 0) + 1
            detailed.append({
                "id": row["id"], "name": row["name"], "binary": row["binary_name"], **result,
            })
            upd.execute(
                "UPDATE tools SET health_status=%s, health_exit_code=%s, "
                "health_evidence=%s, last_health_check=NOW() WHERE id=%s",
                (result["status"], result["exit_code"], result["evidence"], row["id"]),
            )
            if idx % 50 == 0 or idx == total:
                conn.commit()
                elapsed = time.time() - started
                rate = idx / elapsed if elapsed else 0
                eta = (total - idx) / rate if rate else 0
                print(
                    f"[probe] {idx}/{total} ({100*idx/total:.1f}%) "
                    f"ok={summary['ok']} missing={summary['missing']} "
                    f"broken={summary['broken']} timeout={summary['timeout']} "
                    f"rate={rate:.1f}/s eta={eta:.0f}s",
                    flush=True,
                )

    conn.commit()
    cur.close(); upd.close(); conn.close()

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": round(time.time() - started, 1),
        "total": total,
        "summary": summary,
        "details": detailed,
    }
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"[probe] DONE — report: {REPORT_PATH}")
    print(f"[probe] summary: {json.dumps(summary)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
