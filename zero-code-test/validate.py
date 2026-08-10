#!/usr/bin/env python3
import json, urllib.request, urllib.error, time

h=json.load(open("/home/cybersec/cybersec-pro/zero-code-test/harness.json"))
tok=h["tokens"][h["users"][0]]
BASE="http://127.0.0.1:5001"
def call(method, path, body=None, agent_id=None, user=None):
    t = h["tokens"][user] if user else tok
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method, headers={"Authorization":f"Bearer {t}","Content-Type":"application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

s,c = call("GET","/api/v1/tools/dig/config")
print("CONFIG dig:", s, json.dumps(c.get("tool",{}).get("parameters"), ensure_ascii=False)[:400])

# dry-run via offline reverse-tunnel agent
params={"domain":"example.com"}  # dig form field
s,c = call("POST","/api/v1/scan/start", {"tool":"dig","target":"example.com","parameters":params,"agent_id":h["agent_id"]})
print("DRYRUN dig:", s, json.dumps({k:c.get(k) for k in ("command","execution_mode","job_id","message")}, ensure_ascii=False)[:500])

# real run via scan-engine (no agent)
s,c = call("POST","/api/v1/scans", {"tool":"dig","target":"example.com","parameters":params})
print("REALSTART dig:", s, c.get("scan_id"))
sid=c.get("scan_id")
for i in range(40):
    time.sleep(2)
    s,c2 = call("GET",f"/api/v1/scans/{sid}")
    st=(c2.get("scan") or {}).get("status")
    if st not in ("pending","running","initializing","resolving_target","preparing_tool","executing"):
        out=((c2.get("scan") or {}).get("output") or "")[:500]
        print("REALDONE dig:", st, "| output_head:", out.replace("\n"," | ")[:300])
        break
    if i==39: print("REAL dig: still running (stuck)")
