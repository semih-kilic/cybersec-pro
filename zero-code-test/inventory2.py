#!/usr/bin/env python3
import subprocess, json, re

def psql(sql):
    out = subprocess.run(["bash","/home/cybersec/cybersec-pro/rust-backend/.dbq.sh", sql], capture_output=True, text=True)
    return out.stdout.strip() if out.returncode==0 else out.stderr.strip()

rows = psql("""SELECT id, name, COALESCE(parameters::text,'{}'), COALESCE(command_template,''), COALESCE(category,''), COALESCE(binary_name,''), COALESCE(gui_required::text,'f') FROM tools WHERE is_active=TRUE ORDER BY name;""")
target_aliases = {"target","host","url","ip","domain","input","file"}

def derive_form(pv, tpl):
    needs_derive = False
    if pv is None: needs_derive=True
    elif isinstance(pv,dict): needs_derive = (len(pv)==0) or (list(pv.keys())==["form"] and len(pv.get("form",[]))==0)
    elif isinstance(pv,list): needs_derive = len(pv)==0
    if needs_derive and tpl:
        seen=set(); form=[]
        i=0
        while i < len(tpl):
            if tpl[i]=='{':
                e = tpl.find('}', i+1)
                if e!=-1:
                    k=tpl[i+1:e].strip()
                    if k and ' ' not in k and k not in seen:
                        seen.add(k); form.append({"name":k})
                    i=e+1; continue
            i+=1
        return form, True
    if isinstance(pv,dict) and isinstance(pv.get("form"),list): return pv["form"], False
    if isinstance(pv,list) and len(pv)>0: return pv, False
    return [], True

report=[]
for line in rows.splitlines():
    parts=line.split("|")
    if len(parts)<7: continue
    tid,name,params,tpl,cat,binary,gui = parts
    try: pv=json.loads(params)
    except: pv={}
    form, derived = derive_form(pv, tpl)
    uncovered=[]
    for f in form:
        fn=f.get("name") or f.get("label")
        if not fn: continue
        low=fn.lower()
        if ("{"+fn+"}") in tpl: continue
        if low in target_aliases and any(("{"+a+"}") in tpl for a in target_aliases): continue
        uncovered.append(fn)
    report.append({"id":tid,"name":name,"category":cat,"binary":binary,"gui":gui=="t",
        "has_params_db": bool(pv) and not (isinstance(pv,dict) and list(pv.keys())==["form"] and not pv.get("form")),
        "has_template": bool(tpl),"derived":derived,
        "form": form,"template": tpl,
        "uncovered": uncovered,
        "status":"OK" if (tpl and not uncovered) else ("GAP_TEMPLATE" if not tpl else "GAP_FIELDS")})

with open("/home/cybersec/cybersec-pro/zero-code-test/inventory183.json","w") as f:
    json.dump(report,f,indent=1,ensure_ascii=False)

from collections import Counter
print("TOTAL",len(report)); print(dict(Counter(r["status"] for r in report)))
print()
print("=== GAP_FIELDS (form fields not covered by template) ===")
for r in report:
    if r["status"]=="GAP_FIELDS":
        print(f'{r["name"]} | tpl={r["template"]!r} | fields={[ (f.get("name"),f.get("type")) for f in r["form"] ]} | uncovered={r["uncovered"]}')
print()
print("=== GAP_TEMPLATE summary (no command_template) ===")
for r in report:
    if r["status"]=="GAP_TEMPLATE":
        print(f'{r["name"]} | has_params={r["has_params_db"]} | fields={[ (f.get("name"),f.get("type")) for f in r["form"] ]}')
