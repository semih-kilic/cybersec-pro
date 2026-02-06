#!/usr/bin/env python3
"""Core test for Scan Engine V3 without authentication"""

from scan_engine_v3 import ScanEngineV3, NmapParser
import time

print('🧪 Testing Scan Engine V3 Core...')

# Create engine
engine = ScanEngineV3(max_workers=2)

# Test 1: Command building
print('\n📌 Test 1: Command Building')
cmd = engine.build_nmap_command('8.8.8.8', {'ports': '53,80,443', 'timing': 'T4'})
print(f'   ✅ Nmap command: {" ".join(cmd)}')

cmd2 = engine.build_command('whois', 'google.com', {})
print(f'   ✅ Whois command: {" ".join(cmd2)}')

cmd3 = engine.build_command('dig', 'google.com', {'record_type': 'MX'})
print(f'   ✅ Dig command: {" ".join(cmd3)}')

# Test 2: Nmap parser
print('\n📌 Test 2: Nmap XML Parser')
sample_xml = '''<?xml version="1.0"?>
<nmaprun>
<host>
<address addr="8.8.8.8"/>
<ports>
<port protocol="tcp" portid="53"><state state="open"/><service name="domain" product="Google DNS"/></port>
<port protocol="tcp" portid="443"><state state="open"/><service name="https" product="nginx"/></port>
</ports>
</host>
</nmaprun>'''

findings = NmapParser.parse_xml(sample_xml, '8.8.8.8')
print(f'   ✅ Parsed {len(findings)} findings from XML:')
for f in findings:
    print(f'      - Port {f.port}/{f.protocol}: {f.service} ({f.state}) [{f.severity}]')

# Test 3: Text parser fallback
print('\n📌 Test 3: Nmap Text Parser (Fallback)')
sample_text = '''
Starting Nmap 7.98 at 2026-02-05
PORT    STATE SERVICE
22/tcp  open  ssh
80/tcp  open  http
443/tcp open  https
3306/tcp closed mysql
'''
findings2 = NmapParser.parse_text(sample_text, '192.168.1.1')
print(f'   ✅ Parsed {len(findings2)} findings from text:')
for f in findings2:
    print(f'      - Port {f.port}/{f.protocol}: {f.service} ({f.state}) [{f.severity}]')

# Test 4: Stats
print('\n📌 Test 4: Engine Stats')
stats = engine.get_stats()
print(f'   ✅ Max workers: {stats["max_workers"]}')
print(f'   ✅ Active scans: {stats["active_scans"]}')
print(f'   ✅ Completed: {stats["completed_scans"]}')

print('\n✅ ALL CORE TESTS PASSED!')
engine.shutdown()
