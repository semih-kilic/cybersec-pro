#!/usr/bin/env python3
import json, re
from collections import Counter

d = json.load(open('/home/cybersec/tool_smoke_results.json'))
broken = d['broken']

bins = Counter()
scripts = []
abs_paths = []
for t in broken:
    r = t.get('reason')
    ev = t.get('evidence', '')
    name = t.get('name', '?')
    if r == 'binary_not_found':
        m = re.search(r'binary_name=(\S+)', ev)
        b = m.group(1) if m else name
        bins[b] += 1
    elif r == 'script_not_found':
        scripts.append((t['id'], name, ev))
    elif r == 'absolute_path_missing':
        abs_paths.append((t['id'], name, ev))

print(f"=== UNIQUE BINARIES MISSING: {len(bins)} ===")
for b, c in sorted(bins.items()):
    print(f"  {b}" + (f" (x{c})" if c > 1 else ""))

print(f"\n=== SCRIPTS NOT FOUND: {len(scripts)} ===")
for tid, name, ev in scripts:
    print(f"  {tid:30s} {name:25s} {ev[:90]}")

print(f"\n=== ABSOLUTE PATHS MISSING: {len(abs_paths)} ===")
for tid, name, ev in abs_paths:
    print(f"  {tid:30s} {name:25s} {ev}")
