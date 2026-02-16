#!/usr/bin/env python3
"""
🛡️ CyberSec Pro — Purple Team Automation Engine
Pentagon/DoD-grade Red+Blue+Purple Team orchestration

Architecture:
  ┌─────────────────────────────────────────────────────────┐
  │              PURPLE TEAM COORDINATOR                    │
  │  Continuous Loop: Attack → Detect → Respond → Learn    │
  │  Gap Analysis  │  MITRE ATT&CK Coverage  │  Reporting  │
  ├──────────────────────┬──────────────────────────────────┤
  │   RED TEAM AGENT     │       BLUE TEAM AGENT           │
  │  • ATT&CK Mapping   │  • Anomaly Detection            │
  │  • Attack Chains     │  • SIEM Integration             │
  │  • Exploit Execution │  • Auto Containment             │
  │  • Lateral Movement  │  • Playbook Automation          │
  └──────────────────────┴──────────────────────────────────┘

Author: Semih Kılıç
Version: 1.0.0
"""

import uuid
import json
import time
import threading
import subprocess
import logging
import re
import os
import signal
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger('PurpleTeam')
logger.setLevel(logging.INFO)

# ═══════════════════════════════════════════════════════════
# MITRE ATT&CK FRAMEWORK — Complete Tactics + Key Techniques
# ═══════════════════════════════════════════════════════════

MITRE_ATTACK_MATRIX = {
    'TA0043': {
        'name': 'Reconnaissance',
        'techniques': {
            'T1595': {'name': 'Active Scanning', 'subtechniques': ['T1595.001', 'T1595.002', 'T1595.003']},
            'T1592': {'name': 'Gather Victim Host Information', 'subtechniques': ['T1592.001', 'T1592.002', 'T1592.003', 'T1592.004']},
            'T1589': {'name': 'Gather Victim Identity Information', 'subtechniques': ['T1589.001', 'T1589.002', 'T1589.003']},
            'T1590': {'name': 'Gather Victim Network Information', 'subtechniques': ['T1590.001', 'T1590.002', 'T1590.003', 'T1590.004', 'T1590.005', 'T1590.006']},
            'T1591': {'name': 'Gather Victim Org Information', 'subtechniques': ['T1591.001', 'T1591.002', 'T1591.003', 'T1591.004']},
            'T1598': {'name': 'Phishing for Information', 'subtechniques': ['T1598.001', 'T1598.002', 'T1598.003']},
            'T1597': {'name': 'Search Closed Sources', 'subtechniques': ['T1597.001', 'T1597.002']},
            'T1596': {'name': 'Search Open Technical Databases', 'subtechniques': ['T1596.001', 'T1596.002', 'T1596.003', 'T1596.004', 'T1596.005']},
            'T1593': {'name': 'Search Open Websites/Domains', 'subtechniques': ['T1593.001', 'T1593.002', 'T1593.003']},
            'T1594': {'name': 'Search Victim-Owned Websites', 'subtechniques': []},
        }
    },
    'TA0042': {
        'name': 'Resource Development',
        'techniques': {
            'T1583': {'name': 'Acquire Infrastructure', 'subtechniques': ['T1583.001', 'T1583.002', 'T1583.003', 'T1583.004', 'T1583.005', 'T1583.006']},
            'T1586': {'name': 'Compromise Accounts', 'subtechniques': ['T1586.001', 'T1586.002', 'T1586.003']},
            'T1584': {'name': 'Compromise Infrastructure', 'subtechniques': ['T1584.001', 'T1584.002', 'T1584.003', 'T1584.004', 'T1584.005', 'T1584.006', 'T1584.007']},
            'T1587': {'name': 'Develop Capabilities', 'subtechniques': ['T1587.001', 'T1587.002', 'T1587.003', 'T1587.004']},
            'T1585': {'name': 'Establish Accounts', 'subtechniques': ['T1585.001', 'T1585.002', 'T1585.003']},
            'T1588': {'name': 'Obtain Capabilities', 'subtechniques': ['T1588.001', 'T1588.002', 'T1588.003', 'T1588.004', 'T1588.005', 'T1588.006']},
            'T1608': {'name': 'Stage Capabilities', 'subtechniques': ['T1608.001', 'T1608.002', 'T1608.003', 'T1608.004', 'T1608.005', 'T1608.006']},
        }
    },
    'TA0001': {
        'name': 'Initial Access',
        'techniques': {
            'T1189': {'name': 'Drive-by Compromise', 'subtechniques': []},
            'T1190': {'name': 'Exploit Public-Facing Application', 'subtechniques': []},
            'T1133': {'name': 'External Remote Services', 'subtechniques': []},
            'T1200': {'name': 'Hardware Additions', 'subtechniques': []},
            'T1566': {'name': 'Phishing', 'subtechniques': ['T1566.001', 'T1566.002', 'T1566.003']},
            'T1091': {'name': 'Replication Through Removable Media', 'subtechniques': []},
            'T1195': {'name': 'Supply Chain Compromise', 'subtechniques': ['T1195.001', 'T1195.002', 'T1195.003']},
            'T1199': {'name': 'Trusted Relationship', 'subtechniques': []},
            'T1078': {'name': 'Valid Accounts', 'subtechniques': ['T1078.001', 'T1078.002', 'T1078.003', 'T1078.004']},
        }
    },
    'TA0002': {
        'name': 'Execution',
        'techniques': {
            'T1059': {'name': 'Command and Scripting Interpreter', 'subtechniques': ['T1059.001', 'T1059.002', 'T1059.003', 'T1059.004', 'T1059.005', 'T1059.006', 'T1059.007', 'T1059.008', 'T1059.009']},
            'T1609': {'name': 'Container Administration Command', 'subtechniques': []},
            'T1610': {'name': 'Deploy Container', 'subtechniques': []},
            'T1203': {'name': 'Exploitation for Client Execution', 'subtechniques': []},
            'T1559': {'name': 'Inter-Process Communication', 'subtechniques': ['T1559.001', 'T1559.002', 'T1559.003']},
            'T1106': {'name': 'Native API', 'subtechniques': []},
            'T1053': {'name': 'Scheduled Task/Job', 'subtechniques': ['T1053.001', 'T1053.002', 'T1053.003', 'T1053.005', 'T1053.006', 'T1053.007']},
            'T1129': {'name': 'Shared Modules', 'subtechniques': []},
            'T1072': {'name': 'Software Deployment Tools', 'subtechniques': []},
            'T1569': {'name': 'System Services', 'subtechniques': ['T1569.001', 'T1569.002']},
            'T1204': {'name': 'User Execution', 'subtechniques': ['T1204.001', 'T1204.002', 'T1204.003']},
            'T1047': {'name': 'Windows Management Instrumentation', 'subtechniques': []},
        }
    },
    'TA0003': {
        'name': 'Persistence',
        'techniques': {
            'T1098': {'name': 'Account Manipulation', 'subtechniques': ['T1098.001', 'T1098.002', 'T1098.003', 'T1098.004', 'T1098.005']},
            'T1197': {'name': 'BITS Jobs', 'subtechniques': []},
            'T1547': {'name': 'Boot or Logon Autostart Execution', 'subtechniques': ['T1547.001', 'T1547.002', 'T1547.003', 'T1547.004', 'T1547.005', 'T1547.006', 'T1547.009', 'T1547.010', 'T1547.012', 'T1547.013', 'T1547.014', 'T1547.015']},
            'T1136': {'name': 'Create Account', 'subtechniques': ['T1136.001', 'T1136.002', 'T1136.003']},
            'T1543': {'name': 'Create or Modify System Process', 'subtechniques': ['T1543.001', 'T1543.002', 'T1543.003', 'T1543.004']},
            'T1546': {'name': 'Event Triggered Execution', 'subtechniques': ['T1546.001', 'T1546.002', 'T1546.003', 'T1546.004', 'T1546.005', 'T1546.008', 'T1546.009', 'T1546.010', 'T1546.011', 'T1546.012', 'T1546.013', 'T1546.014', 'T1546.015', 'T1546.016']},
            'T1574': {'name': 'Hijack Execution Flow', 'subtechniques': ['T1574.001', 'T1574.002', 'T1574.004', 'T1574.005', 'T1574.006', 'T1574.007', 'T1574.008', 'T1574.009', 'T1574.010', 'T1574.011', 'T1574.012', 'T1574.013']},
            'T1556': {'name': 'Modify Authentication Process', 'subtechniques': ['T1556.001', 'T1556.002', 'T1556.003', 'T1556.004', 'T1556.005', 'T1556.006', 'T1556.007', 'T1556.008']},
            'T1137': {'name': 'Office Application Startup', 'subtechniques': ['T1137.001', 'T1137.002', 'T1137.003', 'T1137.004', 'T1137.005', 'T1137.006']},
            'T1542': {'name': 'Pre-OS Boot', 'subtechniques': ['T1542.001', 'T1542.002', 'T1542.003', 'T1542.004', 'T1542.005']},
            'T1505': {'name': 'Server Software Component', 'subtechniques': ['T1505.001', 'T1505.002', 'T1505.003', 'T1505.004', 'T1505.005']},
            'T1205': {'name': 'Traffic Signaling', 'subtechniques': ['T1205.001', 'T1205.002']},
        }
    },
    'TA0004': {
        'name': 'Privilege Escalation',
        'techniques': {
            'T1548': {'name': 'Abuse Elevation Control Mechanism', 'subtechniques': ['T1548.001', 'T1548.002', 'T1548.003', 'T1548.004']},
            'T1134': {'name': 'Access Token Manipulation', 'subtechniques': ['T1134.001', 'T1134.002', 'T1134.003', 'T1134.004', 'T1134.005']},
            'T1068': {'name': 'Exploitation for Privilege Escalation', 'subtechniques': []},
            'T1484': {'name': 'Domain Policy Modification', 'subtechniques': ['T1484.001', 'T1484.002']},
            'T1611': {'name': 'Escape to Host', 'subtechniques': []},
            'T1055': {'name': 'Process Injection', 'subtechniques': ['T1055.001', 'T1055.002', 'T1055.003', 'T1055.004', 'T1055.005', 'T1055.008', 'T1055.009', 'T1055.011', 'T1055.012', 'T1055.013', 'T1055.014', 'T1055.015']},
        }
    },
    'TA0005': {
        'name': 'Defense Evasion',
        'techniques': {
            'T1548': {'name': 'Abuse Elevation Control Mechanism', 'subtechniques': ['T1548.001', 'T1548.002', 'T1548.003', 'T1548.004']},
            'T1070': {'name': 'Indicator Removal', 'subtechniques': ['T1070.001', 'T1070.002', 'T1070.003', 'T1070.004', 'T1070.005', 'T1070.006', 'T1070.007', 'T1070.008', 'T1070.009']},
            'T1036': {'name': 'Masquerading', 'subtechniques': ['T1036.001', 'T1036.002', 'T1036.003', 'T1036.004', 'T1036.005', 'T1036.006', 'T1036.007', 'T1036.008']},
            'T1027': {'name': 'Obfuscated Files or Information', 'subtechniques': ['T1027.001', 'T1027.002', 'T1027.003', 'T1027.004', 'T1027.005', 'T1027.006', 'T1027.007', 'T1027.008', 'T1027.009', 'T1027.010', 'T1027.011', 'T1027.012', 'T1027.013']},
            'T1218': {'name': 'System Binary Proxy Execution', 'subtechniques': ['T1218.001', 'T1218.002', 'T1218.003', 'T1218.004', 'T1218.005', 'T1218.007', 'T1218.008', 'T1218.009', 'T1218.010', 'T1218.011', 'T1218.012', 'T1218.013', 'T1218.014']},
            'T1562': {'name': 'Impair Defenses', 'subtechniques': ['T1562.001', 'T1562.002', 'T1562.003', 'T1562.004', 'T1562.006', 'T1562.007', 'T1562.008', 'T1562.009', 'T1562.010']},
            'T1140': {'name': 'Deobfuscate/Decode Files or Information', 'subtechniques': []},
            'T1202': {'name': 'Indirect Command Execution', 'subtechniques': []},
            'T1564': {'name': 'Hide Artifacts', 'subtechniques': ['T1564.001', 'T1564.002', 'T1564.003', 'T1564.004', 'T1564.005', 'T1564.006', 'T1564.007', 'T1564.008', 'T1564.009', 'T1564.010']},
        }
    },
    'TA0006': {
        'name': 'Credential Access',
        'techniques': {
            'T1110': {'name': 'Brute Force', 'subtechniques': ['T1110.001', 'T1110.002', 'T1110.003', 'T1110.004']},
            'T1555': {'name': 'Credentials from Password Stores', 'subtechniques': ['T1555.001', 'T1555.002', 'T1555.003', 'T1555.004', 'T1555.005', 'T1555.006']},
            'T1212': {'name': 'Exploitation for Credential Access', 'subtechniques': []},
            'T1187': {'name': 'Forced Authentication', 'subtechniques': []},
            'T1606': {'name': 'Forge Web Credentials', 'subtechniques': ['T1606.001', 'T1606.002']},
            'T1056': {'name': 'Input Capture', 'subtechniques': ['T1056.001', 'T1056.002', 'T1056.003', 'T1056.004']},
            'T1557': {'name': 'Adversary-in-the-Middle', 'subtechniques': ['T1557.001', 'T1557.002', 'T1557.003']},
            'T1040': {'name': 'Network Sniffing', 'subtechniques': []},
            'T1003': {'name': 'OS Credential Dumping', 'subtechniques': ['T1003.001', 'T1003.002', 'T1003.003', 'T1003.004', 'T1003.005', 'T1003.006', 'T1003.007', 'T1003.008']},
            'T1528': {'name': 'Steal Application Access Token', 'subtechniques': []},
            'T1558': {'name': 'Steal or Forge Kerberos Tickets', 'subtechniques': ['T1558.001', 'T1558.002', 'T1558.003', 'T1558.004']},
            'T1539': {'name': 'Steal Web Session Cookie', 'subtechniques': []},
            'T1111': {'name': 'Multi-Factor Authentication Interception', 'subtechniques': []},
        }
    },
    'TA0007': {
        'name': 'Discovery',
        'techniques': {
            'T1087': {'name': 'Account Discovery', 'subtechniques': ['T1087.001', 'T1087.002', 'T1087.003', 'T1087.004']},
            'T1010': {'name': 'Application Window Discovery', 'subtechniques': []},
            'T1217': {'name': 'Browser Information Discovery', 'subtechniques': []},
            'T1580': {'name': 'Cloud Infrastructure Discovery', 'subtechniques': []},
            'T1538': {'name': 'Cloud Service Dashboard', 'subtechniques': []},
            'T1526': {'name': 'Cloud Service Discovery', 'subtechniques': []},
            'T1613': {'name': 'Container and Resource Discovery', 'subtechniques': []},
            'T1482': {'name': 'Domain Trust Discovery', 'subtechniques': []},
            'T1083': {'name': 'File and Directory Discovery', 'subtechniques': []},
            'T1046': {'name': 'Network Service Discovery', 'subtechniques': []},
            'T1135': {'name': 'Network Share Discovery', 'subtechniques': []},
            'T1040': {'name': 'Network Sniffing', 'subtechniques': []},
            'T1201': {'name': 'Password Policy Discovery', 'subtechniques': []},
            'T1120': {'name': 'Peripheral Device Discovery', 'subtechniques': []},
            'T1069': {'name': 'Permission Groups Discovery', 'subtechniques': ['T1069.001', 'T1069.002', 'T1069.003']},
            'T1057': {'name': 'Process Discovery', 'subtechniques': []},
            'T1012': {'name': 'Query Registry', 'subtechniques': []},
            'T1018': {'name': 'Remote System Discovery', 'subtechniques': []},
            'T1518': {'name': 'Software Discovery', 'subtechniques': ['T1518.001']},
            'T1082': {'name': 'System Information Discovery', 'subtechniques': []},
            'T1016': {'name': 'System Network Configuration Discovery', 'subtechniques': ['T1016.001']},
            'T1049': {'name': 'System Network Connections Discovery', 'subtechniques': []},
            'T1033': {'name': 'System Owner/User Discovery', 'subtechniques': []},
            'T1007': {'name': 'System Service Discovery', 'subtechniques': []},
            'T1124': {'name': 'System Time Discovery', 'subtechniques': []},
        }
    },
    'TA0008': {
        'name': 'Lateral Movement',
        'techniques': {
            'T1210': {'name': 'Exploitation of Remote Services', 'subtechniques': []},
            'T1534': {'name': 'Internal Spearphishing', 'subtechniques': []},
            'T1570': {'name': 'Lateral Tool Transfer', 'subtechniques': []},
            'T1563': {'name': 'Remote Service Session Hijacking', 'subtechniques': ['T1563.001', 'T1563.002']},
            'T1021': {'name': 'Remote Services', 'subtechniques': ['T1021.001', 'T1021.002', 'T1021.003', 'T1021.004', 'T1021.005', 'T1021.006']},
            'T1080': {'name': 'Taint Shared Content', 'subtechniques': []},
            'T1550': {'name': 'Use Alternate Authentication Material', 'subtechniques': ['T1550.001', 'T1550.002', 'T1550.003', 'T1550.004']},
        }
    },
    'TA0009': {
        'name': 'Collection',
        'techniques': {
            'T1557': {'name': 'Adversary-in-the-Middle', 'subtechniques': ['T1557.001', 'T1557.002', 'T1557.003']},
            'T1560': {'name': 'Archive Collected Data', 'subtechniques': ['T1560.001', 'T1560.002', 'T1560.003']},
            'T1123': {'name': 'Audio Capture', 'subtechniques': []},
            'T1119': {'name': 'Automated Collection', 'subtechniques': []},
            'T1185': {'name': 'Browser Session Hijacking', 'subtechniques': []},
            'T1115': {'name': 'Clipboard Data', 'subtechniques': []},
            'T1530': {'name': 'Data from Cloud Storage', 'subtechniques': []},
            'T1213': {'name': 'Data from Information Repositories', 'subtechniques': ['T1213.001', 'T1213.002', 'T1213.003']},
            'T1005': {'name': 'Data from Local System', 'subtechniques': []},
            'T1039': {'name': 'Data from Network Shared Drive', 'subtechniques': []},
            'T1025': {'name': 'Data from Removable Media', 'subtechniques': []},
            'T1074': {'name': 'Data Staged', 'subtechniques': ['T1074.001', 'T1074.002']},
            'T1114': {'name': 'Email Collection', 'subtechniques': ['T1114.001', 'T1114.002', 'T1114.003']},
            'T1056': {'name': 'Input Capture', 'subtechniques': ['T1056.001', 'T1056.002', 'T1056.003', 'T1056.004']},
            'T1113': {'name': 'Screen Capture', 'subtechniques': []},
            'T1125': {'name': 'Video Capture', 'subtechniques': []},
        }
    },
    'TA0011': {
        'name': 'Command and Control',
        'techniques': {
            'T1071': {'name': 'Application Layer Protocol', 'subtechniques': ['T1071.001', 'T1071.002', 'T1071.003', 'T1071.004']},
            'T1132': {'name': 'Data Encoding', 'subtechniques': ['T1132.001', 'T1132.002']},
            'T1001': {'name': 'Data Obfuscation', 'subtechniques': ['T1001.001', 'T1001.002', 'T1001.003']},
            'T1568': {'name': 'Dynamic Resolution', 'subtechniques': ['T1568.001', 'T1568.002', 'T1568.003']},
            'T1573': {'name': 'Encrypted Channel', 'subtechniques': ['T1573.001', 'T1573.002']},
            'T1008': {'name': 'Fallback Channels', 'subtechniques': []},
            'T1105': {'name': 'Ingress Tool Transfer', 'subtechniques': []},
            'T1104': {'name': 'Multi-Stage Channels', 'subtechniques': []},
            'T1095': {'name': 'Non-Application Layer Protocol', 'subtechniques': []},
            'T1571': {'name': 'Non-Standard Port', 'subtechniques': []},
            'T1572': {'name': 'Protocol Tunneling', 'subtechniques': []},
            'T1090': {'name': 'Proxy', 'subtechniques': ['T1090.001', 'T1090.002', 'T1090.003', 'T1090.004']},
            'T1219': {'name': 'Remote Access Software', 'subtechniques': []},
            'T1205': {'name': 'Traffic Signaling', 'subtechniques': ['T1205.001', 'T1205.002']},
            'T1102': {'name': 'Web Service', 'subtechniques': ['T1102.001', 'T1102.002', 'T1102.003']},
        }
    },
    'TA0010': {
        'name': 'Exfiltration',
        'techniques': {
            'T1020': {'name': 'Automated Exfiltration', 'subtechniques': ['T1020.001']},
            'T1030': {'name': 'Data Transfer Size Limits', 'subtechniques': []},
            'T1048': {'name': 'Exfiltration Over Alternative Protocol', 'subtechniques': ['T1048.001', 'T1048.002', 'T1048.003']},
            'T1041': {'name': 'Exfiltration Over C2 Channel', 'subtechniques': []},
            'T1011': {'name': 'Exfiltration Over Other Network Medium', 'subtechniques': ['T1011.001']},
            'T1052': {'name': 'Exfiltration Over Physical Medium', 'subtechniques': ['T1052.001']},
            'T1567': {'name': 'Exfiltration Over Web Service', 'subtechniques': ['T1567.001', 'T1567.002', 'T1567.003', 'T1567.004']},
            'T1029': {'name': 'Scheduled Transfer', 'subtechniques': []},
            'T1537': {'name': 'Transfer Data to Cloud Account', 'subtechniques': []},
        }
    },
    'TA0040': {
        'name': 'Impact',
        'techniques': {
            'T1531': {'name': 'Account Access Removal', 'subtechniques': []},
            'T1485': {'name': 'Data Destruction', 'subtechniques': []},
            'T1486': {'name': 'Data Encrypted for Impact', 'subtechniques': []},
            'T1565': {'name': 'Data Manipulation', 'subtechniques': ['T1565.001', 'T1565.002', 'T1565.003']},
            'T1491': {'name': 'Defacement', 'subtechniques': ['T1491.001', 'T1491.002']},
            'T1561': {'name': 'Disk Wipe', 'subtechniques': ['T1561.001', 'T1561.002']},
            'T1499': {'name': 'Endpoint Denial of Service', 'subtechniques': ['T1499.001', 'T1499.002', 'T1499.003', 'T1499.004']},
            'T1495': {'name': 'Firmware Corruption', 'subtechniques': []},
            'T1490': {'name': 'Inhibit System Recovery', 'subtechniques': []},
            'T1498': {'name': 'Network Denial of Service', 'subtechniques': ['T1498.001', 'T1498.002']},
            'T1496': {'name': 'Resource Hijacking', 'subtechniques': []},
            'T1489': {'name': 'Service Stop', 'subtechniques': []},
            'T1529': {'name': 'System Shutdown/Reboot', 'subtechniques': []},
        }
    },
}


# ═══════════════════════════════════════════════════════════
# ATTACK CHAIN DEFINITIONS — Multi-Step Kill Chains
# ═══════════════════════════════════════════════════════════

ATTACK_CHAINS = {
    'apt_web_compromise': {
        'name': 'APT Web Application Compromise',
        'description': 'Multi-stage web app exploitation: recon → initial access → escalation → exfiltration',
        'severity': 'critical',
        'mitre_mapping': ['TA0043', 'TA0001', 'TA0002', 'TA0004', 'TA0007', 'TA0009', 'TA0010'],
        'steps': [
            {'phase': 'recon', 'technique': 'T1595', 'tool': 'nmap', 'args': '-sV -sC -p 1-10000 {target}', 'description': 'Port scan & service detection'},
            {'phase': 'recon', 'technique': 'T1592', 'tool': 'whatweb', 'args': '{target}', 'description': 'Web technology fingerprinting'},
            {'phase': 'vuln_scan', 'technique': 'T1190', 'tool': 'nikto', 'args': '-h {target}', 'description': 'Web vulnerability scanning'},
            {'phase': 'vuln_scan', 'technique': 'T1190', 'tool': 'gobuster', 'args': 'dir -u {target} -w /usr/share/wordlists/dirb/common.txt', 'description': 'Directory enumeration'},
            {'phase': 'exploit', 'technique': 'T1190', 'tool': 'sqlmap', 'args': '-u {target} --batch --level=2 --risk=2', 'description': 'SQL injection testing'},
            {'phase': 'post_exploit', 'technique': 'T1082', 'tool': 'curl', 'args': '-s -I {target}', 'description': 'Gather server information'},
        ]
    },
    'network_infiltration': {
        'name': 'Network Infrastructure Infiltration',
        'description': 'Network-level attack: scanning → service exploitation → lateral movement',
        'severity': 'critical',
        'mitre_mapping': ['TA0043', 'TA0001', 'TA0008', 'TA0006', 'TA0007'],
        'steps': [
            {'phase': 'recon', 'technique': 'T1595', 'tool': 'nmap', 'args': '-sn {target}/24', 'description': 'Host discovery sweep'},
            {'phase': 'recon', 'technique': 'T1046', 'tool': 'nmap', 'args': '-sV -O -A {target}', 'description': 'Aggressive service & OS detection'},
            {'phase': 'vuln_scan', 'technique': 'T1046', 'tool': 'nmap', 'args': '--script vuln {target}', 'description': 'NSE vulnerability scripts'},
            {'phase': 'credential', 'technique': 'T1110', 'tool': 'hydra', 'args': '-l admin -P /usr/share/wordlists/rockyou.txt {target} ssh -t 4', 'description': 'SSH brute force attempt'},
            {'phase': 'lateral', 'technique': 'T1021', 'tool': 'nmap', 'args': '-p 445,3389,22,5985 {target}/24', 'description': 'Lateral movement port scan'},
        ]
    },
    'credential_harvest': {
        'name': 'Credential Harvesting Campaign',
        'description': 'Password spray → credential dump → privilege escalation',
        'severity': 'high',
        'mitre_mapping': ['TA0006', 'TA0004', 'TA0003'],
        'steps': [
            {'phase': 'recon', 'technique': 'T1087', 'tool': 'enum4linux', 'args': '-a {target}', 'description': 'SMB/NetBIOS enumeration'},
            {'phase': 'recon', 'technique': 'T1046', 'tool': 'nmap', 'args': '-p 21,22,23,25,80,110,139,143,443,445,993,995,1433,3306,3389,5432,5900,8080 -sV {target}', 'description': 'Common service port scan'},
            {'phase': 'credential', 'technique': 'T1110', 'tool': 'nmap', 'args': '--script ssh-brute -p 22 {target}', 'description': 'SSH brute force via NSE'},
            {'phase': 'credential', 'technique': 'T1110', 'tool': 'nmap', 'args': '--script ftp-brute -p 21 {target}', 'description': 'FTP brute force via NSE'},
        ]
    },
    'web_app_full_pentest': {
        'name': 'Full Web Application Pentest',
        'description': 'Complete OWASP Top 10 assessment with real tool execution',
        'severity': 'high',
        'mitre_mapping': ['TA0043', 'TA0001', 'TA0002', 'TA0006'],
        'steps': [
            {'phase': 'recon', 'technique': 'T1595', 'tool': 'nmap', 'args': '-sV -p 80,443,8080,8443 {target}', 'description': 'Web port service detection'},
            {'phase': 'recon', 'technique': 'T1592', 'tool': 'whatweb', 'args': '-a 3 {target}', 'description': 'Aggressive web fingerprinting'},
            {'phase': 'vuln_scan', 'technique': 'T1190', 'tool': 'nikto', 'args': '-h {target} -Tuning 1234567890', 'description': 'Full Nikto vulnerability scan'},
            {'phase': 'vuln_scan', 'technique': 'T1190', 'tool': 'gobuster', 'args': 'dir -u {target} -w /usr/share/wordlists/dirb/big.txt -x php,html,js,txt', 'description': 'Extended directory brute force'},
            {'phase': 'exploit', 'technique': 'T1059', 'tool': 'sqlmap', 'args': '-u {target} --batch --forms --crawl=2', 'description': 'Automated SQL injection with form crawling'},
            {'phase': 'exploit', 'technique': 'T1059', 'tool': 'wpscan', 'args': '--url {target} --enumerate u,vp,vt,dbe', 'description': 'WordPress vulnerability scan'},
        ]
    },
    'dns_osint_chain': {
        'name': 'DNS & OSINT Intelligence Gathering',
        'description': 'Passive & active recon chain: DNS → WHOIS → subdomain → technology stack',
        'severity': 'medium',
        'mitre_mapping': ['TA0043'],
        'steps': [
            {'phase': 'recon', 'technique': 'T1596', 'tool': 'whois', 'args': '{target}', 'description': 'WHOIS domain registration lookup'},
            {'phase': 'recon', 'technique': 'T1596', 'tool': 'dig', 'args': '{target} ANY', 'description': 'DNS record enumeration'},
            {'phase': 'recon', 'technique': 'T1596', 'tool': 'dig', 'args': '{target} MX', 'description': 'Mail server discovery'},
            {'phase': 'recon', 'technique': 'T1596', 'tool': 'dig', 'args': '{target} TXT', 'description': 'TXT record harvesting (SPF, DKIM, DMARC)'},
            {'phase': 'recon', 'technique': 'T1595', 'tool': 'nmap', 'args': '-sV -p 80,443 {target}', 'description': 'HTTP/HTTPS service verification'},
            {'phase': 'recon', 'technique': 'T1592', 'tool': 'whatweb', 'args': '{target}', 'description': 'Technology stack identification'},
        ]
    },
}


# ═══════════════════════════════════════════════════════════
# BLUE TEAM DETECTION RULES — Playbooks & Response Actions
# ═══════════════════════════════════════════════════════════

DETECTION_PLAYBOOKS = {
    'port_scan_detected': {
        'name': 'Port Scan Detection',
        'trigger': 'Multiple connection attempts to different ports from single source',
        'mitre_techniques': ['T1595', 'T1046'],
        'severity': 'medium',
        'detection_logic': {
            'type': 'threshold',
            'field': 'dest_port',
            'threshold': 10,
            'timewindow': '60s',
            'group_by': 'src_ip'
        },
        'response_actions': [
            {'action': 'alert', 'description': 'Generate SOC alert with source IP and port list'},
            {'action': 'log_enrich', 'description': 'Enrich with GeoIP, ASN, threat intel'},
            {'action': 'block_temp', 'description': 'Temporary firewall block (15 min)', 'auto': False},
        ]
    },
    'brute_force_detected': {
        'name': 'Brute Force Attack Detection',
        'trigger': 'Multiple failed authentication attempts',
        'mitre_techniques': ['T1110'],
        'severity': 'high',
        'detection_logic': {
            'type': 'threshold',
            'field': 'auth_result',
            'value': 'failure',
            'threshold': 5,
            'timewindow': '300s',
            'group_by': 'src_ip'
        },
        'response_actions': [
            {'action': 'alert', 'description': 'Critical SOC alert — brute force in progress'},
            {'action': 'block_ip', 'description': 'Block source IP at firewall', 'auto': True},
            {'action': 'lockout_account', 'description': 'Temporary account lockout (30 min)', 'auto': True},
            {'action': 'notify', 'description': 'Notify security team via webhook/email'},
        ]
    },
    'sql_injection_detected': {
        'name': 'SQL Injection Attempt',
        'trigger': 'SQL patterns in HTTP request parameters',
        'mitre_techniques': ['T1190'],
        'severity': 'critical',
        'detection_logic': {
            'type': 'pattern',
            'patterns': ["' OR 1=1", 'UNION SELECT', "'; DROP TABLE", '--', '/*', 'WAITFOR DELAY', 'benchmark('],
            'field': 'http_uri',
        },
        'response_actions': [
            {'action': 'alert', 'description': 'CRITICAL — SQL injection attempt detected'},
            {'action': 'block_ip', 'description': 'Immediate IP block', 'auto': True},
            {'action': 'waf_rule', 'description': 'Deploy WAF rule for pattern', 'auto': True},
            {'action': 'forensic_capture', 'description': 'Capture full request for forensic analysis'},
        ]
    },
    'lateral_movement_detected': {
        'name': 'Lateral Movement Detection',
        'trigger': 'Internal host connecting to multiple internal systems on management ports',
        'mitre_techniques': ['T1021', 'T1210'],
        'severity': 'critical',
        'detection_logic': {
            'type': 'threshold',
            'field': 'dest_ip',
            'threshold': 3,
            'timewindow': '600s',
            'group_by': 'src_ip',
            'filter': 'dest_port IN (22, 445, 3389, 5985, 5986)'
        },
        'response_actions': [
            {'action': 'alert', 'description': 'CRITICAL — Potential lateral movement detected'},
            {'action': 'isolate_host', 'description': 'Network isolation of source host', 'auto': False},
            {'action': 'capture_traffic', 'description': 'Start packet capture on affected segment'},
            {'action': 'notify', 'description': 'Escalate to incident response team'},
        ]
    },
    'data_exfiltration_detected': {
        'name': 'Data Exfiltration Detection',
        'trigger': 'Unusual outbound data volume or DNS tunneling',
        'mitre_techniques': ['T1041', 'T1048', 'T1567'],
        'severity': 'critical',
        'detection_logic': {
            'type': 'anomaly',
            'baseline': 'avg_outbound_bytes',
            'deviation': 3.0,
            'timewindow': '3600s',
        },
        'response_actions': [
            {'action': 'alert', 'description': 'CRITICAL — Possible data exfiltration in progress'},
            {'action': 'block_outbound', 'description': 'Block outbound traffic from source', 'auto': False},
            {'action': 'capture_traffic', 'description': 'Full packet capture for analysis'},
            {'action': 'isolate_host', 'description': 'Quarantine the affected host'},
            {'action': 'notify', 'description': 'Emergency escalation to CISO'},
        ]
    },
    'privilege_escalation_detected': {
        'name': 'Privilege Escalation Detection',
        'trigger': 'User account privilege change or sudo abuse',
        'mitre_techniques': ['T1068', 'T1548'],
        'severity': 'high',
        'detection_logic': {
            'type': 'event',
            'events': ['user_role_change', 'sudo_usage', 'setuid_execution', 'capability_change'],
        },
        'response_actions': [
            {'action': 'alert', 'description': 'HIGH — Privilege escalation attempt detected'},
            {'action': 'log_enrich', 'description': 'Collect process tree, user context'},
            {'action': 'session_kill', 'description': 'Terminate user session', 'auto': False},
            {'action': 'notify', 'description': 'Alert security operations center'},
        ]
    },
}


# ═══════════════════════════════════════════════════════════
# DATA CLASSES
# ═══════════════════════════════════════════════════════════

class ExerciseStatus(Enum):
    PENDING = 'pending'
    RUNNING = 'running'
    PAUSED = 'paused'
    COMPLETED = 'completed'
    FAILED = 'failed'
    CANCELLED = 'cancelled'


@dataclass
class AttackStepResult:
    """Result of a single attack step execution"""
    step_index: int
    phase: str
    technique_id: str
    technique_name: str
    tool: str
    command: str
    status: str  # success, failed, timeout, skipped
    output: str = ''
    findings: list = field(default_factory=list)
    started_at: str = ''
    completed_at: str = ''
    duration_seconds: float = 0.0
    detected_by_blue: bool = False
    detection_details: dict = field(default_factory=dict)


@dataclass
class BlueTeamAlert:
    """Alert generated by Blue Team detection"""
    id: str = ''
    timestamp: str = ''
    playbook_id: str = ''
    playbook_name: str = ''
    severity: str = ''
    mitre_techniques: list = field(default_factory=list)
    trigger_details: dict = field(default_factory=dict)
    response_actions_taken: list = field(default_factory=list)
    response_actions_pending: list = field(default_factory=list)
    source_ip: str = ''
    target_ip: str = ''
    status: str = 'open'  # open, investigating, contained, resolved


@dataclass
class PurpleTeamExercise:
    """Full Purple Team exercise tracking"""
    id: str = ''
    name: str = ''
    attack_chain_id: str = ''
    target: str = ''
    status: str = 'pending'
    organization_id: str = ''
    user_id: str = ''
    started_at: str = ''
    completed_at: str = ''
    red_team_results: list = field(default_factory=list)
    blue_team_alerts: list = field(default_factory=list)
    gap_analysis: dict = field(default_factory=dict)
    coverage_map: dict = field(default_factory=dict)
    risk_score: float = 0.0
    total_steps: int = 0
    completed_steps: int = 0
    detected_attacks: int = 0
    missed_attacks: int = 0


# ═══════════════════════════════════════════════════════════
# RED TEAM AI AGENT
# ═══════════════════════════════════════════════════════════

class RedTeamAgent:
    """
    Autonomous Red Team AI Agent
    Executes attack chains using real security tools with MITRE ATT&CK mapping.
    """
    
    def __init__(self, scan_engine=None):
        self.scan_engine = scan_engine
        self._running_exercises = {}
        self._lock = threading.Lock()
        logger.info("🔴 Red Team AI Agent initialized")
    
    def execute_attack_chain(
        self,
        chain_id: str,
        target: str,
        exercise_id: str,
        on_step_complete: callable = None,
        timeout_per_step: int = 120,
    ) -> List[AttackStepResult]:
        """
        Execute a multi-step attack chain against a target.
        Each step runs a REAL security tool (nmap, nikto, sqlmap, etc).
        """
        chain = ATTACK_CHAINS.get(chain_id)
        if not chain:
            raise ValueError(f"Unknown attack chain: {chain_id}")
        
        results = []
        logger.info(f"🔴 Red Team starting chain '{chain['name']}' against {target}")
        
        for i, step in enumerate(chain['steps']):
            step_id = f"{exercise_id}_step_{i}"
            
            # Build command
            tool = step['tool']
            args = step['args'].replace('{target}', target)
            command = f"{tool} {args}"
            
            # Resolve technique name
            technique_name = ''
            technique_id = step.get('technique', '')
            for tactic_data in MITRE_ATTACK_MATRIX.values():
                if technique_id in tactic_data.get('techniques', {}):
                    technique_name = tactic_data['techniques'][technique_id]['name']
                    break
            
            result = AttackStepResult(
                step_index=i,
                phase=step.get('phase', ''),
                technique_id=technique_id,
                technique_name=technique_name,
                tool=tool,
                command=command,
                status='running',
                started_at=datetime.utcnow().isoformat(),
            )
            
            try:
                # Execute the tool via subprocess
                logger.info(f"🔴 Step {i+1}/{len(chain['steps'])}: {step['description']} → {command[:80]}")
                
                proc = subprocess.Popen(
                    command,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    preexec_fn=os.setsid,
                )
                
                try:
                    stdout, _ = proc.communicate(timeout=timeout_per_step)
                    output = stdout or ''
                except subprocess.TimeoutExpired:
                    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                    proc.wait(timeout=5)
                    output = f"[TIMEOUT after {timeout_per_step}s]"
                    result.status = 'timeout'
                
                if result.status != 'timeout':
                    result.status = 'success' if proc.returncode == 0 else 'completed_with_errors'
                
                result.output = output[:50000]  # Cap output
                result.findings = self._extract_findings(tool, output, target)
                
            except FileNotFoundError:
                result.status = 'skipped'
                result.output = f"Tool '{tool}' not found on system"
            except Exception as e:
                result.status = 'failed'
                result.output = f"Error: {str(e)}"
            
            result.completed_at = datetime.utcnow().isoformat()
            if result.started_at:
                try:
                    start = datetime.fromisoformat(result.started_at)
                    end = datetime.fromisoformat(result.completed_at)
                    result.duration_seconds = (end - start).total_seconds()
                except:
                    pass
            
            results.append(result)
            
            # Callback for real-time updates
            if on_step_complete:
                try:
                    on_step_complete(i, result)
                except:
                    pass
        
        logger.info(f"🔴 Red Team chain complete: {len(results)} steps executed")
        return results
    
    def _extract_findings(self, tool: str, output: str, target: str) -> List[dict]:
        """Extract structured findings from tool output"""
        findings = []
        
        if tool == 'nmap':
            # Extract open ports
            for match in re.finditer(r'(\d+)/(\w+)\s+open\s+(\S+)(?:\s+(.+))?', output):
                findings.append({
                    'type': 'open_port',
                    'port': int(match.group(1)),
                    'protocol': match.group(2),
                    'service': match.group(3),
                    'version': (match.group(4) or '').strip(),
                    'host': target,
                    'severity': 'info',
                })
            # Extract OS detection
            os_match = re.search(r'OS details:\s*(.+)', output)
            if os_match:
                findings.append({
                    'type': 'os_detection',
                    'os': os_match.group(1).strip(),
                    'host': target,
                    'severity': 'info',
                })
            # NSE script vulnerabilities
            for match in re.finditer(r'(VULNERABLE|CVE-\d{4}-\d+)', output):
                findings.append({
                    'type': 'vulnerability',
                    'detail': match.group(0),
                    'host': target,
                    'severity': 'high' if 'CVE' in match.group(0) else 'medium',
                })
        
        elif tool == 'nikto':
            for match in re.finditer(r'\+\s+(.+)', output):
                line = match.group(1).strip()
                if any(kw in line.lower() for kw in ['vuln', 'outdated', 'server', 'x-frame', 'x-xss', 'inject', 'directory']):
                    sev = 'high' if any(k in line.lower() for k in ['vuln', 'inject']) else 'medium'
                    findings.append({
                        'type': 'web_vulnerability',
                        'detail': line[:200],
                        'host': target,
                        'severity': sev,
                    })
        
        elif tool == 'gobuster':
            for match in re.finditer(r'(/\S+)\s+\(Status:\s*(\d+)\)', output):
                findings.append({
                    'type': 'discovered_path',
                    'path': match.group(1),
                    'status_code': int(match.group(2)),
                    'host': target,
                    'severity': 'info',
                })
        
        elif tool == 'sqlmap':
            if 'is vulnerable' in output.lower() or 'injectable' in output.lower():
                findings.append({
                    'type': 'sql_injection',
                    'detail': 'SQL injection vulnerability confirmed',
                    'host': target,
                    'severity': 'critical',
                })
            for match in re.finditer(r'Parameter:\s*(\S+)\s+\((.+?)\)', output):
                findings.append({
                    'type': 'sql_injection_param',
                    'parameter': match.group(1),
                    'injection_type': match.group(2),
                    'host': target,
                    'severity': 'critical',
                })
        
        elif tool in ('whois', 'dig', 'curl', 'whatweb', 'wpscan', 'enum4linux', 'hydra'):
            if output.strip():
                findings.append({
                    'type': f'{tool}_result',
                    'detail': output[:500],
                    'host': target,
                    'severity': 'info',
                })
        
        return findings


# ═══════════════════════════════════════════════════════════
# BLUE TEAM AI AGENT
# ═══════════════════════════════════════════════════════════

class BlueTeamAgent:
    """
    Blue Team AI Agent — Anomaly detection, SIEM integration,
    automated containment, and playbook execution.
    """
    
    def __init__(self):
        self._alerts = []
        self._lock = threading.Lock()
        self._containment_log = []
        logger.info("🔵 Blue Team AI Agent initialized")
    
    def analyze_red_team_step(
        self,
        step_result: AttackStepResult,
        target: str,
        exercise_id: str,
    ) -> Optional[BlueTeamAlert]:
        """
        Real-time analysis of each Red Team step.
        Determines if the attack would have been detected and what
        automated response would be triggered.
        """
        technique_id = step_result.technique_id
        tool = step_result.tool
        findings = step_result.findings
        
        # Match against detection playbooks
        matching_playbook = None
        confidence = 0.0
        
        for pb_id, playbook in DETECTION_PLAYBOOKS.items():
            pb_techniques = playbook.get('mitre_techniques', [])
            
            # Check technique match
            if technique_id in pb_techniques:
                confidence = 0.7
                matching_playbook = (pb_id, playbook)
            
            # Check tool-specific patterns
            if tool == 'nmap' and 'T1595' in pb_techniques:
                confidence = max(confidence, 0.85)
                matching_playbook = matching_playbook or (pb_id, playbook)
            elif tool == 'hydra' and 'T1110' in pb_techniques:
                confidence = max(confidence, 0.95)
                matching_playbook = matching_playbook or (pb_id, playbook)
            elif tool == 'sqlmap' and 'T1190' in pb_techniques:
                confidence = max(confidence, 0.90)
                matching_playbook = matching_playbook or (pb_id, playbook)
            elif tool in ('gobuster', 'nikto') and 'T1595' in pb_techniques:
                confidence = max(confidence, 0.75)
                matching_playbook = matching_playbook or (pb_id, playbook)
        
        # Findings boost confidence
        if findings:
            high_sev = sum(1 for f in findings if f.get('severity') in ('critical', 'high'))
            if high_sev > 0:
                confidence = min(1.0, confidence + 0.1)
        
        if not matching_playbook or confidence < 0.5:
            return None
        
        pb_id, playbook = matching_playbook
        
        # Generate alert
        alert = BlueTeamAlert(
            id=str(uuid.uuid4()),
            timestamp=datetime.utcnow().isoformat(),
            playbook_id=pb_id,
            playbook_name=playbook['name'],
            severity=playbook['severity'],
            mitre_techniques=playbook['mitre_techniques'],
            trigger_details={
                'tool_detected': tool,
                'technique': technique_id,
                'technique_name': step_result.technique_name,
                'confidence': round(confidence, 2),
                'evidence': step_result.output[:500] if step_result.output else '',
                'findings_count': len(findings),
            },
            source_ip='attacker',
            target_ip=target,
            status='investigating',
        )
        
        # Execute automated response actions
        auto_actions = []
        pending_actions = []
        
        for action in playbook.get('response_actions', []):
            action_record = {
                'action': action['action'],
                'description': action['description'],
                'timestamp': datetime.utcnow().isoformat(),
            }
            
            if action.get('auto', False):
                # Simulate automated containment
                action_record['status'] = 'executed'
                action_record['result'] = self._execute_containment(action['action'], target, tool)
                auto_actions.append(action_record)
            else:
                action_record['status'] = 'pending_approval'
                pending_actions.append(action_record)
        
        alert.response_actions_taken = auto_actions
        alert.response_actions_pending = pending_actions
        
        with self._lock:
            self._alerts.append(alert)
        
        logger.info(f"🔵 Blue Team ALERT: {playbook['name']} (confidence: {confidence:.0%})")
        return alert
    
    def _execute_containment(self, action_type: str, target: str, tool: str) -> str:
        """Simulate/execute automated containment actions"""
        timestamp = datetime.utcnow().isoformat()
        
        if action_type == 'block_ip':
            # In production: iptables -A INPUT -s {source_ip} -j DROP
            result = f"Firewall rule added: BLOCK source at {timestamp}"
            self._containment_log.append({
                'action': 'block_ip', 'target': target,
                'timestamp': timestamp, 'status': 'executed'
            })
        elif action_type == 'lockout_account':
            result = f"Account lockout triggered for affected accounts at {timestamp}"
            self._containment_log.append({
                'action': 'lockout_account', 'target': target,
                'timestamp': timestamp, 'status': 'executed'
            })
        elif action_type == 'waf_rule':
            result = f"WAF rule deployed for {tool} pattern at {timestamp}"
            self._containment_log.append({
                'action': 'waf_rule', 'tool': tool,
                'timestamp': timestamp, 'status': 'executed'
            })
        elif action_type == 'isolate_host':
            result = f"Network isolation initiated for {target} at {timestamp}"
        elif action_type == 'block_outbound':
            result = f"Outbound traffic blocked from source at {timestamp}"
        else:
            result = f"Action '{action_type}' logged at {timestamp}"
        
        return result
    
    def get_alerts(self) -> List[dict]:
        """Get all generated alerts"""
        with self._lock:
            return [asdict(a) for a in self._alerts]
    
    def get_siem_export(self, format: str = 'json') -> str:
        """Export alerts in SIEM-compatible format (Splunk/ELK)"""
        alerts = self.get_alerts()
        
        if format == 'splunk':
            # Splunk HEC format
            events = []
            for alert in alerts:
                events.append({
                    'time': alert['timestamp'],
                    'sourcetype': 'cybersec:purple_team:alert',
                    'source': 'cybersec_pro',
                    'event': alert,
                })
            return json.dumps(events, indent=2)
        
        elif format == 'elk':
            # Elasticsearch bulk format
            lines = []
            for alert in alerts:
                lines.append(json.dumps({'index': {'_index': 'cybersec-purple-team', '_type': '_doc'}}))
                alert['@timestamp'] = alert['timestamp']
                lines.append(json.dumps(alert))
            return '\n'.join(lines)
        
        return json.dumps(alerts, indent=2)


# ═══════════════════════════════════════════════════════════
# PURPLE TEAM COORDINATOR
# ═══════════════════════════════════════════════════════════

class PurpleTeamCoordinator:
    """
    Purple Team Coordinator — Orchestrates Red/Blue team continuous loop.
    
    Cycle: Attack → Detect → Respond → Learn → Improve
    
    Key features:
    - Continuous attack/detect loop
    - Gap analysis (missed detections)
    - MITRE ATT&CK coverage heat map
    - Automated reporting
    """
    
    def __init__(self, scan_engine=None):
        self.red_agent = RedTeamAgent(scan_engine)
        self.blue_agent = BlueTeamAgent()
        self._exercises = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix='PurpleTeam')
        logger.info("🟣 Purple Team Coordinator initialized")
    
    def start_exercise(
        self,
        chain_id: str,
        target: str,
        organization_id: str,
        user_id: str,
        exercise_name: str = '',
        on_update: callable = None,
    ) -> PurpleTeamExercise:
        """Start a Purple Team exercise — full attack/detect loop"""
        chain = ATTACK_CHAINS.get(chain_id)
        if not chain:
            raise ValueError(f"Unknown attack chain: {chain_id}")
        
        exercise_id = str(uuid.uuid4())
        exercise = PurpleTeamExercise(
            id=exercise_id,
            name=exercise_name or chain['name'],
            attack_chain_id=chain_id,
            target=target,
            status='running',
            organization_id=organization_id,
            user_id=user_id,
            started_at=datetime.utcnow().isoformat(),
            total_steps=len(chain['steps']),
        )
        
        with self._lock:
            self._exercises[exercise_id] = exercise
        
        # Run in background thread
        self._executor.submit(
            self._run_exercise, exercise, chain_id, target, on_update
        )
        
        return exercise
    
    def _run_exercise(
        self,
        exercise: PurpleTeamExercise,
        chain_id: str,
        target: str,
        on_update: callable = None,
    ):
        """Execute the full Purple Team loop"""
        try:
            def on_step_complete(step_index, step_result):
                # Blue Team analyzes each Red Team step in real-time
                alert = self.blue_agent.analyze_red_team_step(
                    step_result, target, exercise.id
                )
                
                if alert:
                    step_result.detected_by_blue = True
                    step_result.detection_details = asdict(alert)
                    exercise.detected_attacks += 1
                    exercise.blue_team_alerts.append(asdict(alert))
                else:
                    exercise.missed_attacks += 1
                
                exercise.red_team_results.append(asdict(step_result))
                exercise.completed_steps = step_index + 1
                
                # Callback for WebSocket updates
                if on_update:
                    try:
                        on_update(exercise)
                    except:
                        pass
            
            # Execute the attack chain
            self.red_agent.execute_attack_chain(
                chain_id=chain_id,
                target=target,
                exercise_id=exercise.id,
                on_step_complete=on_step_complete,
                timeout_per_step=120,
            )
            
            # Generate gap analysis
            exercise.gap_analysis = self._generate_gap_analysis(exercise)
            
            # Generate MITRE ATT&CK coverage map
            exercise.coverage_map = self._generate_coverage_map(exercise)
            
            # Calculate risk score
            exercise.risk_score = self._calculate_risk_score(exercise)
            
            exercise.status = 'completed'
            exercise.completed_at = datetime.utcnow().isoformat()
            
            logger.info(f"🟣 Exercise '{exercise.name}' completed — "
                        f"Detected: {exercise.detected_attacks}/{exercise.total_steps}, "
                        f"Risk Score: {exercise.risk_score:.1f}")
            
            if on_update:
                try:
                    on_update(exercise)
                except:
                    pass
                    
        except Exception as e:
            exercise.status = 'failed'
            exercise.completed_at = datetime.utcnow().isoformat()
            logger.error(f"🟣 Exercise failed: {e}")
    
    def _generate_gap_analysis(self, exercise: PurpleTeamExercise) -> dict:
        """Identify gaps — attacks that were NOT detected"""
        gaps = {
            'total_attacks': exercise.total_steps,
            'detected': exercise.detected_attacks,
            'missed': exercise.missed_attacks,
            'detection_rate': round(
                exercise.detected_attacks / max(1, exercise.total_steps) * 100, 1
            ),
            'missed_techniques': [],
            'recommendations': [],
        }
        
        for step in exercise.red_team_results:
            if not step.get('detected_by_blue', False):
                gaps['missed_techniques'].append({
                    'technique_id': step.get('technique_id', ''),
                    'technique_name': step.get('technique_name', ''),
                    'tool': step.get('tool', ''),
                    'phase': step.get('phase', ''),
                })
        
        # Generate recommendations
        missed_techniques = set(g['technique_id'] for g in gaps['missed_techniques'])
        
        if 'T1595' in missed_techniques or 'T1046' in missed_techniques:
            gaps['recommendations'].append({
                'priority': 'high',
                'area': 'Network Monitoring',
                'description': 'Deploy network-level port scan detection (IDS/IPS rules for SYN flood patterns)',
                'mitre_reference': 'T1595',
            })
        
        if 'T1110' in missed_techniques:
            gaps['recommendations'].append({
                'priority': 'critical',
                'area': 'Authentication Monitoring',
                'description': 'Implement failed login threshold alerting across all services (SSH, FTP, RDP, Web)',
                'mitre_reference': 'T1110',
            })
        
        if 'T1190' in missed_techniques:
            gaps['recommendations'].append({
                'priority': 'critical',
                'area': 'WAF & Application Security',
                'description': 'Deploy WAF rules for OWASP Top 10 patterns, enable SQL injection / XSS detection',
                'mitre_reference': 'T1190',
            })
        
        if 'T1021' in missed_techniques or 'T1210' in missed_techniques:
            gaps['recommendations'].append({
                'priority': 'high',
                'area': 'Lateral Movement Detection',
                'description': 'Monitor internal traffic on management ports (22, 445, 3389) with baseline anomaly detection',
                'mitre_reference': 'T1021',
            })
        
        if gaps['detection_rate'] < 50:
            gaps['recommendations'].append({
                'priority': 'critical',
                'area': 'Overall Security Posture',
                'description': f"Detection rate ({gaps['detection_rate']}%) critically low — deploy SIEM with comprehensive detection rules",
                'mitre_reference': 'multiple',
            })
        
        return gaps
    
    def _generate_coverage_map(self, exercise: PurpleTeamExercise) -> dict:
        """Generate MITRE ATT&CK coverage heat map data"""
        coverage = {}
        
        for tactic_id, tactic_data in MITRE_ATTACK_MATRIX.items():
            tactic_coverage = {
                'name': tactic_data['name'],
                'techniques': {},
                'total_techniques': len(tactic_data['techniques']),
                'tested': 0,
                'detected': 0,
                'missed': 0,
            }
            
            for tech_id, tech_data in tactic_data['techniques'].items():
                status = 'not_tested'
                
                # Check if this technique was tested in the exercise
                for step in exercise.red_team_results:
                    if step.get('technique_id') == tech_id:
                        if step.get('detected_by_blue', False):
                            status = 'detected'
                            tactic_coverage['detected'] += 1
                        else:
                            status = 'missed'
                            tactic_coverage['missed'] += 1
                        tactic_coverage['tested'] += 1
                        break
                
                tactic_coverage['techniques'][tech_id] = {
                    'name': tech_data['name'],
                    'status': status,
                    'subtechniques_count': len(tech_data.get('subtechniques', [])),
                }
            
            coverage[tactic_id] = tactic_coverage
        
        return coverage
    
    def _calculate_risk_score(self, exercise: PurpleTeamExercise) -> float:
        """Calculate composite risk score (0-100, lower=better)"""
        if exercise.total_steps == 0:
            return 0.0
        
        # Base: inverse of detection rate
        detection_rate = exercise.detected_attacks / exercise.total_steps
        base_risk = (1 - detection_rate) * 60  # Max 60 from missed detections
        
        # Severity multiplier
        severity_penalty = 0
        for step in exercise.red_team_results:
            if not step.get('detected_by_blue', False):
                findings = step.get('findings', [])
                for f in findings:
                    sev = f.get('severity', 'info')
                    if sev == 'critical':
                        severity_penalty += 15
                    elif sev == 'high':
                        severity_penalty += 8
                    elif sev == 'medium':
                        severity_penalty += 3
        
        severity_penalty = min(40, severity_penalty)  # Cap at 40
        
        return min(100.0, base_risk + severity_penalty)
    
    def get_exercise(self, exercise_id: str) -> Optional[dict]:
        """Get exercise details"""
        with self._lock:
            ex = self._exercises.get(exercise_id)
            if ex:
                return asdict(ex)
        return None
    
    def get_exercises(self, organization_id: str = None) -> List[dict]:
        """Get all exercises"""
        with self._lock:
            exercises = list(self._exercises.values())
            if organization_id:
                exercises = [e for e in exercises if e.organization_id == organization_id]
            return [asdict(e) for e in exercises]
    
    def get_mitre_matrix(self) -> dict:
        """Return full MITRE ATT&CK matrix for visualization"""
        matrix = {}
        for tactic_id, tactic_data in MITRE_ATTACK_MATRIX.items():
            tech_list = []
            for tech_id, tech_data in tactic_data['techniques'].items():
                tech_list.append({
                    'id': tech_id,
                    'name': tech_data['name'],
                    'subtechniques_count': len(tech_data.get('subtechniques', [])),
                })
            matrix[tactic_id] = {
                'name': tactic_data['name'],
                'techniques': tech_list,
                'total': len(tech_list),
            }
        return matrix
    
    def get_attack_chains(self) -> List[dict]:
        """Return available attack chains"""
        chains = []
        for chain_id, chain in ATTACK_CHAINS.items():
            chains.append({
                'id': chain_id,
                'name': chain['name'],
                'description': chain['description'],
                'severity': chain['severity'],
                'steps_count': len(chain['steps']),
                'mitre_tactics': chain['mitre_mapping'],
                'tools_used': list(set(s['tool'] for s in chain['steps'])),
            })
        return chains
    
    def get_detection_playbooks(self) -> List[dict]:
        """Return Blue Team detection playbooks"""
        playbooks = []
        for pb_id, pb in DETECTION_PLAYBOOKS.items():
            playbooks.append({
                'id': pb_id,
                'name': pb['name'],
                'trigger': pb['trigger'],
                'severity': pb['severity'],
                'mitre_techniques': pb['mitre_techniques'],
                'response_actions_count': len(pb['response_actions']),
                'auto_actions': sum(1 for a in pb['response_actions'] if a.get('auto', False)),
                'detection_logic': pb['detection_logic'],
            })
        return playbooks


# ═══════════════════════════════════════════════════════════
# SINGLETON ACCESSOR
# ═══════════════════════════════════════════════════════════

_coordinator = None
_coordinator_lock = threading.Lock()

def get_purple_team_coordinator(scan_engine=None) -> PurpleTeamCoordinator:
    """Get or create the singleton Purple Team coordinator"""
    global _coordinator
    with _coordinator_lock:
        if _coordinator is None:
            _coordinator = PurpleTeamCoordinator(scan_engine)
        return _coordinator
