#!/usr/bin/env python3
"""Test NmapParser directly"""
from scan_engine_v3 import NmapParser

# Test with sample XML similar to what we're getting
sample_xml = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE nmaprun>
<?xml-stylesheet href="file:///usr/share/nmap/nmap.xsl" type="text/xsl"?>
<!-- Nmap 7.98 scan initiated Sat Feb  7 18:13:29 2026 as: /usr/lib/nmap/nmap -oX - -T4 -p 22,80 -sV -sS scanme.nmap.org -->
<nmaprun scanner="nmap" args="/usr/lib/nmap/nmap -oX - -T4 -p 22,80 -sV -sS scanme.nmap.org" start="1770768809" startstr="Sat Feb  7 18:13:29 2026" version="7.98" xmloutputversion="1.05">
<scaninfo type="syn" protocol="tcp" numservices="2" services="22,80"/>
<verbose level="0"/>
<debugging level="0"/>
<host starttime="1770768810" endtime="1770768815">
<status state="up" reason="echo-reply" reason_ttl="52"/>
<address addr="45.33.32.156" addrtype="ipv4"/>
<hostnames>
<hostname name="scanme.nmap.org" type="user"/>
<hostname name="scanme.nmap.org" type="PTR"/>
</hostnames>
<ports>
<port protocol="tcp" portid="22">
<state state="open" reason="syn-ack" reason_ttl="52"/>
<service name="ssh" product="OpenSSH" version="6.6.1p1 Ubuntu 2ubuntu2.13" extrainfo="Ubuntu Linux; protocol 2.0" ostype="Linux" method="probed" conf="10">
<cpe>cpe:/a:openbsd:openssh:6.6.1p1</cpe>
<cpe>cpe:/o:linux:linux_kernel</cpe>
</service>
</port>
<port protocol="tcp" portid="80">
<state state="open" reason="syn-ack" reason_ttl="52"/>
<service name="http" product="Apache httpd" version="2.4.7" extrainfo="(Ubuntu)" method="probed" conf="10">
<cpe>cpe:/a:apache:http_server:2.4.7</cpe>
</service>
</port>
</ports>
<times srtt="85231" rttvar="36870" to="232711"/>
</host>
<runstats>
<finished time="1770768815" timestr="Sat Feb  7 18:13:35 2026" summary="Nmap done at Sat Feb  7 18:13:35 2026; 1 IP address (1 host up) scanned in 6.02 seconds" elapsed="6.02" exit="success"/>
<hosts up="1" down="0" total="1"/>
</runstats>
</nmaprun>'''

print("Testing NmapParser.parse_xml()...")
print("=" * 50)

try:
    findings = NmapParser.parse_xml(sample_xml, 'scanme.nmap.org')
    print(f"Findings count: {len(findings)}")
    for f in findings:
        print(f"  - Port {f.port}/{f.protocol}: {f.service} ({f.state}) [{f.severity}]")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()

# Also test parse_text
print("\nTesting NmapParser.parse_text()...")
print("=" * 50)

sample_text = '''Starting Nmap 7.98 ( https://nmap.org )
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 6.6.1p1
80/tcp open  http    Apache httpd 2.4.7

Nmap done: 1 IP address (1 host up)'''

try:
    findings2 = NmapParser.parse_text(sample_text, 'scanme.nmap.org')
    print(f"Findings count: {len(findings2)}")
    for f in findings2:
        print(f"  - Port {f.port}/{f.protocol}: {f.service} ({f.state})")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
