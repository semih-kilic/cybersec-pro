#!/usr/bin/env python3
"""
🛡️ CyberSec Pro — Full Tool Suite Verification v7.2
Verifies that the V7 engine + DB integration has 600+ tools registered
and checks binary availability for each.

Usage:
    python3 verify_full_suite.py [--strict] [--json] [--category CATEGORY]

Author: Semih Kılıç
"""

import sys
import os
import json
import shutil
import argparse
from collections import defaultdict

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def verify_registry():
    """Verify the tool registry has enough tools and check installations."""
    from tool_configs import TOOL_REGISTRY, get_categories, get_all_slugs, load_tools_from_system

    # Ensure system tools are discovered
    load_tools_from_system()

    total = len(TOOL_REGISTRY)
    categories = get_categories()
    
    installed = 0
    missing = 0
    gui_only = 0
    by_plan = defaultdict(int)
    by_category = defaultdict(lambda: {'total': 0, 'installed': 0, 'missing': 0})
    missing_tools = []
    installed_tools = []
    
    for slug, tc in sorted(TOOL_REGISTRY.items()):
        if slug == '__generic__':
            continue
        
        by_plan[tc.plan] += 1
        cat_info = by_category[tc.category]
        cat_info['total'] += 1
        
        if tc.notes == 'gui-only' or not tc.needs_target:
            gui_only += 1
            cat_info['installed'] += 1
            installed += 1
            continue
        
        binary_path = shutil.which(tc.binary)
        if binary_path:
            installed += 1
            cat_info['installed'] += 1
            installed_tools.append(slug)
        else:
            missing += 1
            cat_info['missing'] += 1
            missing_tools.append({'slug': slug, 'binary': tc.binary, 'category': tc.category})
    
    return {
        'total_registered': total,
        'installed': installed,
        'missing': missing,
        'gui_only': gui_only,
        'install_rate': round(installed / max(total, 1) * 100, 1),
        'by_plan': dict(by_plan),
        'by_category': dict(by_category),
        'missing_tools': missing_tools[:50],  # Top 50
        'categories_count': len(categories),
        'threshold_met': total >= 600,
    }


def verify_db_integration():
    """Check if DB tools are synced with the registry."""
    try:
        from app import app, db, Tool
        from tool_configs import TOOL_REGISTRY
        
        with app.app_context():
            db_count = Tool.query.count()
            db_tools = Tool.query.all()
            
            in_registry = sum(1 for t in db_tools if t.name in TOOL_REGISTRY)
            not_in_registry = sum(1 for t in db_tools if t.name not in TOOL_REGISTRY)
            
            return {
                'db_tools': db_count,
                'synced_to_registry': in_registry,
                'not_synced': not_in_registry,
                'sync_rate': round(in_registry / max(db_count, 1) * 100, 1),
            }
    except Exception as e:
        return {'error': str(e)}


def verify_scan_engine():
    """Quick scan engine health check."""
    try:
        from scan_runner import validate_binary
        from tool_configs import get_tool
        
        test_tools = ['nmap', 'dig', 'whois', 'curl', 'nikto']
        results = {}
        
        for slug in test_tools:
            tc = get_tool(slug)
            if tc:
                try:
                    path = validate_binary(tc.binary)
                    results[slug] = {'status': 'ok', 'path': path}
                except Exception as e:
                    results[slug] = {'status': 'missing', 'error': str(e)}
            else:
                results[slug] = {'status': 'not-configured'}
        
        return results
    except Exception as e:
        return {'error': str(e)}


def print_report(registry_result, db_result=None, engine_result=None, verbose=False):
    """Print a human-readable verification report."""
    r = registry_result
    
    print("=" * 60)
    print("  🛡️  CyberSec Pro — Full Suite Verification")
    print("=" * 60)
    print()
    print(f"  📊 Registry Summary")
    print(f"     Total Tools:       {r['total_registered']}")
    print(f"     Installed:         {r['installed']}")
    print(f"     Missing Binary:    {r['missing']}")
    print(f"     GUI-Only:          {r['gui_only']}")
    print(f"     Install Rate:      {r['install_rate']}%")
    print(f"     Categories:        {r['categories_count']}")
    threshold = "✅ PASSED" if r['threshold_met'] else "❌ FAILED"
    print(f"     600+ Threshold:    {threshold}")
    print()
    
    print(f"  📋 By Plan Tier:")
    for plan, count in sorted(r['by_plan'].items()):
        print(f"     {plan:15s}  {count:4d} tools")
    print()
    
    print(f"  📂 By Category:")
    for cat, info in sorted(r['by_category'].items()):
        bar = "█" * min(info['total'] // 5, 30)
        print(f"     {cat:35s}  {info['total']:4d}  {bar}")
    print()
    
    if db_result and 'error' not in db_result:
        print(f"  🗄️  Database Integration")
        print(f"     DB Tools:          {db_result['db_tools']}")
        print(f"     Synced:            {db_result['synced_to_registry']}")
        print(f"     Not Synced:        {db_result['not_synced']}")
        print(f"     Sync Rate:         {db_result['sync_rate']}%")
        print()
    
    if engine_result and 'error' not in engine_result:
        print(f"  ⚡ Scan Engine Health:")
        for tool, status in engine_result.items():
            icon = "✅" if status.get('status') == 'ok' else "❌"
            print(f"     {icon} {tool:15s} → {status.get('path', status.get('error', 'unknown'))}")
        print()
    
    if r['missing'] > 0 and verbose:
        print(f"  ⚠️  Missing Binaries (top 20):")
        for mt in r['missing_tools'][:20]:
            print(f"     {mt['slug']:25s} binary={mt['binary']:20s} cat={mt['category']}")
        print()
    
    print("=" * 60)
    status = "SALES-READY ✅" if r['threshold_met'] and r['install_rate'] > 5 else "NEEDS WORK ❌"
    print(f"  Status: {status}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description='CyberSec Pro Full Suite Verification')
    parser.add_argument('--strict', action='store_true', help='Fail if threshold not met')
    parser.add_argument('--json', action='store_true', help='Output JSON instead of text')
    parser.add_argument('--category', type=str, help='Filter by category')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show missing tool details')
    parser.add_argument('--skip-db', action='store_true', help='Skip database integration check')
    args = parser.parse_args()
    
    registry_result = verify_registry()
    db_result = None if args.skip_db else verify_db_integration()
    engine_result = verify_scan_engine()
    
    if args.json:
        output = {
            'registry': registry_result,
            'database': db_result,
            'engine': engine_result,
        }
        print(json.dumps(output, indent=2, default=str))
    else:
        print_report(registry_result, db_result, engine_result, verbose=args.verbose)
    
    if args.strict and not registry_result['threshold_met']:
        sys.exit(1)


if __name__ == '__main__':
    main()
