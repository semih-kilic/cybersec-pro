#!/usr/bin/env python3
import subprocess, json, re, sys

def psql(sql):
    out = subprocess.run(["bash","/home/cybersec/cybersec-pro/rust-backend/.dbq.sh", sql],
                         capture_output=True, text=True)
    if out.returncode != 0:
        return out.stderr.strip()
    return out.stdout.strip()

rows = psql("""SELECT id, name, COALESCE(parameters::text,'{}'), COALESCE(command_template,''), category FROM tools ORDER BY name;""")
# split by newline; each line: id|name|params|template|category
target_aliases = {"target","host","url","ip","domain","input","file"}

def derive_form(params_val, tpl):
    # replicate stub_handlers tool_config logic
    needs_derive = False
    if isinstance(params_val, type(None)): needs_derive = True
    elif isinstance(params_val, dict): needs_derive = (len(params_val)==0) or (list(params_val.keys())==["form"] and len(params_val.get("form",[]))==0)
    elif isinstance(params_val, list): needs_derive = (len(params_val)==0)
    if needs_derive and tpl:
        seen=set(); form=[]
        i=0; b=tpl.encode()
        while i < len(b):
            if b[i:i+1]==b'{':
                end = tpl.find('}', i+1)
                if end != -1:
                    raw = tpl[i+1:end]
                    key = raw.strip()
                    if key and not any(c in key for c in (' ','{','}')) and key not in seen:
                        seen.add(key)
                        form.append({"name": key})
                    i = end+1
                    continue
            i+=1
        return form, True
    if isinstance(params_val, dict) and isinstance(params_val.get("form"), list):
        return params_val["form"], False
    if isinstance(params_val, list) and len(params_val)>0:
        return params_val, False
    return [], True

report = []
for line in rows.splitlines():
    parts = line.split("|", 4)
    if len(parts) < 5: continue
    tid, name, params, tpl, cat = parts
    try: pv = json.loads(params)
    except: pv = {}
    form, derived = derive_form(pv, tpl)
    fieldnames = [f.get("name") or f.get("label") for f in form if f.get("name") or f.get("label")]
    # coverage: each field must appear as {field} in template, OR be a target-alias present in template
    uncovered = []
    for f in fieldnames:
        low = f.lower()
        if ("{"+f+"}") in tpl: continue
        if low in target_aliases and any(("{"+a+"}") in tpl for a in target_aliases): continue
        uncovered.append(f)
    report.append({
        "id": tid, "name": name, "category": cat,
        "has_params_db": bool(pv) and not (isinstance(pv,dict) and list(pv.keys())==["form"] and not pv.get("form")),
        "has_template": bool(tpl), "derived": derived,
        "fields": fieldnames, "template": tpl,
        "uncovered": uncovered,
        "status": "OK" if (tpl and not uncovered) else ("GAP_TEMPLATE" if not tpl else "GAP_FIELDS"),
    })

with open("/home/cybersec/cybersec-pro/zero-code-test/inventory.json","w") as f:
    json.dump(report, f, indent=1, ensure_ascii=False)

# summary
from collections import Counter
c = Counter(r["status"] for r in report)
print("TOTAL", len(report))
for k,v in c.items(): print(k, v)
print("--- tools with GAP (name | status | uncovered): ---")
for r in report:
    if r["status"] != "OK":
        print(f'{r["name"]} | {r["status"]} | fields={r["fields"]} | uncovered={r["uncovered"]} | tpl={r["template"][:90]}')
