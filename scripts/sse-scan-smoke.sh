#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5001/api/v1}"
TARGET="${1:-10.0.0.115}"
EMAIL="${SMOKE_EMAIL:-testdev@cybersec.test}"
PASSWORD="${SMOKE_PASSWORD:-TestPass123!}"
OUT_DIR="${OUT_DIR:-/tmp/cybersec-smoke}"
mkdir -p "$OUT_DIR"

now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

echo "[$(now)] Smoke test start"
echo "[$(now)] BASE_URL=$BASE_URL TARGET=$TARGET"

login_payload=$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")
login_resp=$(curl -s "$BASE_URL/auth/login" -H 'Content-Type: application/json' -d "$login_payload" || true)

TOKEN=$(python3 - <<'PY' "$login_resp"
import json,sys
try:
    d=json.loads(sys.argv[1])
except Exception:
    print("")
    raise SystemExit(0)
print(d.get('access_token') or d.get('token') or "")
PY
)

if [[ -z "$TOKEN" ]]; then
  reg_payload=$(printf '{"email":"%s","password":"%s","first_name":"Smoke","last_name":"User"}' "$EMAIL" "$PASSWORD")
  reg_resp=$(curl -s "$BASE_URL/auth/register" -H 'Content-Type: application/json' -d "$reg_payload")
  TOKEN=$(python3 - <<'PY' "$reg_resp"
import json,sys
try:
    d=json.loads(sys.argv[1])
except Exception:
    print("")
    raise SystemExit(0)
print(d.get('access_token') or d.get('token') or "")
PY
)
fi

if [[ -z "$TOKEN" ]]; then
  echo "[$(now)] ERROR: could not acquire token"
  exit 1
fi

echo "[$(now)] Auth OK"

start_scan() {
  local tool_id="$1"
  local target="$2"
  local payload
  payload=$(printf '{"tool_id":"%s","target":"%s","scan_type":"quick"}' "$tool_id" "$target")
  curl -s -X POST "$BASE_URL/scan/start" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "$payload"
}

stop_scan() {
  local scan_id="$1"
  curl -s -X POST "$BASE_URL/scan/$scan_id/stop" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' >/dev/null || true
}

scan_status() {
  local scan_id="$1"
  curl -s "$BASE_URL/scan/$scan_id/result" \
    -H "Authorization: Bearer $TOKEN" || true
}

# 1) CLI stream validation
nmap_resp=$(start_scan "nmap" "$TARGET")
NMAP_SCAN_ID=$(python3 - <<'PY' "$nmap_resp"
import json,sys
try:
    d=json.loads(sys.argv[1])
except Exception:
    print("")
    raise SystemExit(0)
print(d.get('scan_id') or d.get('scan',{}).get('id') or "")
PY
)

if [[ -z "$NMAP_SCAN_ID" ]]; then
  echo "[$(now)] ERROR: nmap scan did not start"
  echo "$nmap_resp"
  exit 1
fi

echo "[$(now)] nmap scan started: $NMAP_SCAN_ID"

STREAM_FILE="$OUT_DIR/sse_${NMAP_SCAN_ID}.log"
STREAM_HEADERS="$OUT_DIR/sse_${NMAP_SCAN_ID}.headers"
(timeout 12s curl -sN -D "$STREAM_HEADERS" -H "Authorization: Bearer $TOKEN" "$BASE_URL/scan/$NMAP_SCAN_ID/output" || true) > "$STREAM_FILE"

SSE_HTTP_200=$(grep -c "HTTP/1.1 200" "$STREAM_HEADERS" || true)
STREAM_OUTPUT_EVENTS=$(grep -c '"type":"output"' "$STREAM_FILE" || true)
STREAM_COMPLETE_EVENTS=$(grep -c '"type":"complete"' "$STREAM_FILE" || true)

NMAP_STATUS_RAW=$(scan_status "$NMAP_SCAN_ID")
NMAP_STATUS=$(python3 - <<'PY' "$NMAP_STATUS_RAW"
import json,sys
try:
  d=json.loads(sys.argv[1])
except Exception:
  print("unknown")
  raise SystemExit(0)
scan=d.get('scan',{}) if isinstance(d,dict) else {}
print(scan.get('status') or d.get('status') or "unknown")
PY
)

# Stop nmap so we can test additional tools without concurrent-limit conflicts.
stop_scan "$NMAP_SCAN_ID"

# 2) GUI block validation
GUI_RESP=$(start_scan "ghidra" "$TARGET")
GUI_BLOCKED=$(python3 - <<'PY' "$GUI_RESP"
import json,sys
try:
    d=json.loads(sys.argv[1])
except Exception:
    print("false")
    raise SystemExit(0)
print("true" if d.get('code')=='GUI_TOOL' else "false")
PY
)

# 3) Multi-tool start smoke (pipeline health)
TOOLS=(nikto sslyze host nslookup)
TOOL_REPORTS=()
TOOLS_STARTED=0
for tool in "${TOOLS[@]}"; do
  resp=$(start_scan "$tool" "$TARGET")
  item=$(python3 - <<'PY' "$tool" "$resp"
import json,sys
name=sys.argv[1]
raw=sys.argv[2]
try:
    d=json.loads(raw)
except Exception:
    print(f"{name}:invalid_json")
    raise SystemExit(0)
scan_id=d.get('scan_id') or d.get('scan',{}).get('id')
if scan_id:
    print(f"{name}:started:{scan_id}")
elif d.get('code')=='GUI_TOOL':
    print(f"{name}:gui_blocked")
else:
    print(f"{name}:error:{d.get('error','unknown')}")
PY
)
  TOOL_REPORTS+=("$item")
      if [[ "$item" == *":started:"* ]]; then
        scan_id="${item##*:started:}"
        TOOLS_STARTED=$((TOOLS_STARTED + 1))
        stop_scan "$scan_id"
      fi
done

RESULT_FILE="$OUT_DIR/report_${NMAP_SCAN_ID}.json"
python3 - <<'PY' "$RESULT_FILE" "$TARGET" "$NMAP_SCAN_ID" "$STREAM_FILE" "$STREAM_OUTPUT_EVENTS" "$STREAM_COMPLETE_EVENTS" "$SSE_HTTP_200" "$NMAP_STATUS" "$GUI_BLOCKED" "$TOOLS_STARTED" "${TOOL_REPORTS[*]}"
import json,sys
path,target,scan_id,stream_file,output_events,complete_events,sse_http_200,nmap_status,gui_blocked,tools_started,tool_reports = sys.argv[1:]
reports=[]
if tool_reports.strip():
    reports=tool_reports.split()

data={
  "target": target,
  "nmap_scan_id": scan_id,
  "stream_file": stream_file,
  "sse_http_200": int(sse_http_200) > 0,
  "nmap_status_via_api": nmap_status,
  "stream_output_events": int(output_events),
  "stream_complete_events": int(complete_events),
  "gui_tool_blocked": gui_blocked == "true",
  "tools_started_count": int(tools_started),
  "tool_start_reports": reports,
  "pass": (int(sse_http_200) > 0) and (gui_blocked == "true") and (int(tools_started) >= 2)
}
with open(path,'w',encoding='utf-8') as f:
    json.dump(data,f,indent=2)
print(json.dumps(data,indent=2))
PY

echo "[$(now)] Smoke test report: $RESULT_FILE"
if [[ "$SSE_HTTP_200" -gt 0 && "$GUI_BLOCKED" == "true" && "$TOOLS_STARTED" -ge 2 ]]; then
  echo "[$(now)] PASS"
else
  echo "[$(now)] FAIL"
  exit 1
fi
