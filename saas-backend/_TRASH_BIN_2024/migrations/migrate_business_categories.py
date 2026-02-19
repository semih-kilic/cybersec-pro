#!/usr/bin/env python3
"""
Migration: Remap 682 tools from 15 old Kali categories → 6 business categories
Also adds business_name and business_description columns + populates them.

Run: python3 migrate_business_categories.py
"""

import sqlite3
import json
import sys
import os

# Add parent for imports
sys.path.insert(0, os.path.dirname(__file__))
from business_language import (
    TOOL_BUSINESS_NAMES, OLD_TO_NEW_CATEGORY, BUSINESS_CATEGORIES,
    BusinessLanguageTranslator
)

DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'cybersec_saas.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # ── Step 1: Add new columns if not exist ──
    existing_cols = {row[1] for row in cur.execute("PRAGMA table_info(tools)")}
    
    new_columns = {
        'business_name': "VARCHAR(200) DEFAULT ''",
        'business_description': "TEXT DEFAULT ''",
        'business_category': "VARCHAR(50) DEFAULT ''",
        'subcategory': "VARCHAR(100) DEFAULT ''",
        'risk_context': "TEXT DEFAULT ''",
    }
    
    for col_name, col_type in new_columns.items():
        if col_name not in existing_cols:
            cur.execute(f"ALTER TABLE tools ADD COLUMN {col_name} {col_type}")
            print(f"  + Added column: {col_name}")
    
    conn.commit()

    # ── Step 2: Read all tools ──
    tools = cur.execute("SELECT id, name, category FROM tools").fetchall()
    print(f"\n  Total tools: {len(tools)}")

    translator = BusinessLanguageTranslator()
    
    # Stats
    stats = {cat_id: 0 for cat_id in BUSINESS_CATEGORIES}
    direct_mapped = 0
    category_mapped = 0

    # ── Step 3: Update each tool ──
    for tool in tools:
        tool_id = tool['id']
        tool_name = tool['name']
        old_category = tool['category']
        
        # Try direct mapping first (known tools)
        tool_key = tool_name.lower().strip()
        if tool_key in TOOL_BUSINESS_NAMES:
            info = TOOL_BUSINESS_NAMES[tool_key]
            business_name = info['business_name']
            business_desc = info['business_description']
            business_cat = info['business_category']
            subcategory = info.get('subcategory', '')
            risk_context = info.get('risk_context', '')
            direct_mapped += 1
        else:
            # Fallback: use old category → new category mapping
            business_cat = OLD_TO_NEW_CATEGORY.get(old_category, 'web_application_security')
            business_name = translator._generate_business_name(tool_name)
            business_desc = f"Security testing component for comprehensive {BUSINESS_CATEGORIES.get(business_cat, {}).get('name', 'security')} assessment"
            subcategory = _guess_subcategory(tool_name, business_cat)
            risk_context = f"Part of {BUSINESS_CATEGORIES.get(business_cat, {}).get('name', 'security')} testing suite"
            category_mapped += 1

        # Get the display name for new category
        new_category_name = BUSINESS_CATEGORIES.get(business_cat, {}).get('name', old_category)

        cur.execute("""
            UPDATE tools SET
                business_name = ?,
                business_description = ?,
                business_category = ?,
                subcategory = ?,
                risk_context = ?,
                category = ?
            WHERE id = ?
        """, (business_name, business_desc, business_cat, subcategory, risk_context,
              new_category_name, tool_id))

        if business_cat in stats:
            stats[business_cat] += 1

    conn.commit()

    # ── Step 4: Print results ──
    print(f"\n  Direct mapped (known tools): {direct_mapped}")
    print(f"  Category mapped (auto): {category_mapped}")
    print(f"\n  New Category Distribution:")
    for cat_id, count in sorted(stats.items(), key=lambda x: -x[1]):
        cat_name = BUSINESS_CATEGORIES.get(cat_id, {}).get('name', cat_id)
        target = BUSINESS_CATEGORIES.get(cat_id, {}).get('target_count', '?')
        print(f"    {cat_name}: {count} tools (target: {target})")

    # ── Step 5: Verify ──
    verify = cur.execute("""
        SELECT business_category, COUNT(*) as cnt 
        FROM tools 
        GROUP BY business_category 
        ORDER BY cnt DESC
    """).fetchall()
    
    print(f"\n  Verification from DB:")
    for row in verify:
        print(f"    {row['business_category']}: {row['cnt']}")

    total = cur.execute("SELECT COUNT(*) FROM tools WHERE business_name != ''").fetchone()[0]
    print(f"\n  Tools with business names: {total}/682")

    conn.close()
    print("\n  Migration complete!")


def _guess_subcategory(tool_name: str, business_cat: str) -> str:
    """Guess subcategory based on tool name and assigned category"""
    name = tool_name.lower()
    
    subcategory_hints = {
        'web_application_security': {
            'sql': 'SQL Injection Testing',
            'xss': 'Cross-Site Scripting (XSS)',
            'cms': 'CMS Security (WordPress, Joomla, etc.)',
            'wp': 'CMS Security (WordPress, Joomla, etc.)',
            'ssl': 'SSL/TLS Certificate Analysis',
            'tls': 'SSL/TLS Certificate Analysis',
            'dir': 'Directory & Path Traversal',
            'fuzz': 'File Upload Vulnerabilities',
            'waf': 'Web Application Firewall Testing',
            'http': 'HTTP Security Headers',
            'auth': 'Authentication & Session Security',
            'session': 'Authentication & Session Security',
            'cors': 'CORS & CSRF Protection',
            'csrf': 'CORS & CSRF Protection',
            'server': 'Server Misconfiguration',
            'config': 'Server Misconfiguration',
        },
        'data_protection': {
            'pass': 'Password Policy Audit',
            'hash': 'Encryption Strength Analysis',
            'crypt': 'Encryption Strength Analysis',
            'key': 'Key Management Review',
            'secret': 'Data Leak Detection',
            'leak': 'Data Leak Detection',
            'db': 'Database Security Assessment',
            'cred': 'Credential Exposure Check',
            'brute': 'Credential Exposure Check',
            'phish': 'Credential Exposure Check',
        },
        'infrastructure_security': {
            'port': 'Network Port Scanning',
            'scan': 'Network Port Scanning',
            'dns': 'DNS Security Analysis',
            'firewall': 'Firewall Rule Assessment',
            'cloud': 'Cloud Configuration Audit',
            'docker': 'Container Security',
            'container': 'Container Security',
            'wifi': 'Wireless Network Testing',
            'wireless': 'Wireless Network Testing',
            'vpn': 'VPN Security Assessment',
            'sniff': 'Network Traffic Analysis',
            'packet': 'Network Traffic Analysis',
            'os': 'Operating System Security',
            'ids': 'Intrusion Detection Testing',
            'discover': 'Service Discovery',
        },
        'api_mobile_security': {
            'api': 'REST API Security Testing',
            'rest': 'REST API Security Testing',
            'graphql': 'GraphQL Security Analysis',
            'mobile': 'Mobile Backend Security',
            'android': 'Mobile Backend Security',
            'ios': 'Mobile Backend Security',
            'apk': 'Mobile Backend Security',
            'proxy': 'API Traffic Inspector',
            'rate': 'Rate Limiting & Throttling',
        },
        'compliance': {
            'gdpr': 'GDPR Compliance Check',
            'pci': 'PCI-DSS Assessment',
            'hipaa': 'HIPAA Security Audit',
            'iso': 'ISO 27001 Controls',
            'nist': 'NIST Framework Assessment',
            'owasp': 'OWASP Top 10 Verification',
            'cis': 'CIS Benchmark Testing',
            'bench': 'CIS Benchmark Testing',
            'audit': 'CIS Benchmark Testing',
            'forensic': 'Data Retention Audit',
            'report': 'NIST Framework Assessment',
            'policy': 'Privacy Policy Analysis',
        },
        'vulnerability_database': {
            'cve': 'CVE Database Scanning',
            'vuln': 'CVE Database Scanning',
            'exploit': 'Exploit Verification',
            'patch': 'Patch Level Assessment',
            'version': 'Software Version Analysis',
            'threat': 'Threat Intelligence Feeds',
            'nuclei': 'CVE Database Scanning',
        },
    }

    category_hints = subcategory_hints.get(business_cat, {})
    for keyword, subcat in category_hints.items():
        if keyword in name:
            return subcat

    # Default subcategory per category
    defaults = {
        'web_application_security': 'Web Server Hardening',
        'data_protection': 'Data Leak Detection',
        'infrastructure_security': 'Network Port Scanning',
        'api_mobile_security': 'REST API Security Testing',
        'compliance': 'CIS Benchmark Testing',
        'vulnerability_database': 'CVE Database Scanning',
    }
    return defaults.get(business_cat, 'General Security Testing')


if __name__ == '__main__':
    print("=" * 60)
    print("  CyberSec Pro - Business Category Migration")
    print("=" * 60)
    migrate()
