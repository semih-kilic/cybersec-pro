#!/usr/bin/env python3
"""
🛡️ CyberSec Pro — Tool Installation Verifier v7
Checks every tool in the registry and reports installation status.

Usage:
  python verify_installation.py              # Full report
  python verify_installation.py --json       # JSON output
  python verify_installation.py --plan pro   # Only professional tier
  python verify_installation.py --missing    # Only show missing tools

Author : Semih Kılıç
Version: 7.0.0
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from typing import Dict, List, Optional, Tuple

# Import our registry
from tool_configs import TOOL_REGISTRY, get_tools_for_plan, ToolConfig, PLAN_TIERS


# ═══════════════════════════════════════════════
#  VERIFICATION ENGINE
# ═══════════════════════════════════════════════

def check_tool(tool: ToolConfig) -> Dict:
    """
    Verify a single tool:
      - binary exists in PATH
      - try to get version string
    Returns a status dict.
    """
    binary_path = shutil.which(tool.binary)
    installed = binary_path is not None

    version_str: Optional[str] = None
    if installed and tool.version_flag:
        try:
            proc = subprocess.run(
                [binary_path, tool.version_flag],
                capture_output=True,
                text=True,
                timeout=10,
            )
            raw = (proc.stdout or proc.stderr or '').strip()
            # Take first non-empty line, max 120 chars
            for line in raw.split('\n'):
                line = line.strip()
                if line:
                    version_str = line[:120]
                    break
        except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError, OSError):
            version_str = None

    return {
        'slug': tool.slug,
        'name': tool.name,
        'binary': tool.binary,
        'category': tool.category,
        'plan': tool.plan,
        'installed': installed,
        'binary_path': binary_path,
        'version': version_str,
        'dangerous': tool.dangerous,
    }


def verify_all(
    plan_filter: Optional[str] = None,
    only_missing: bool = False,
) -> Tuple[List[Dict], Dict]:
    """
    Verify all tools (or filtered by plan).
    Returns (results_list, summary_dict).
    """
    if plan_filter:
        slugs = get_tools_for_plan(plan_filter)
        tools = [TOOL_REGISTRY[s] for s in slugs if s in TOOL_REGISTRY]
    else:
        tools = list(TOOL_REGISTRY.values())

    results: List[Dict] = []
    for tool in sorted(tools, key=lambda t: (t.category, t.slug)):
        status = check_tool(tool)
        if only_missing and status['installed']:
            continue
        results.append(status)

    total = len(tools)
    installed_count = sum(1 for r in results if r['installed']) if not only_missing else None
    missing_count = sum(1 for r in results if not r['installed'])

    # Category breakdown
    categories: Dict[str, Dict] = {}
    for r in results:
        cat = r['category']
        if cat not in categories:
            categories[cat] = {'installed': 0, 'missing': 0, 'tools': []}
        if r['installed']:
            categories[cat]['installed'] += 1
        else:
            categories[cat]['missing'] += 1
        categories[cat]['tools'].append(r['slug'])

    # Plan tier breakdown
    plan_stats: Dict[str, Dict] = {}
    for tier in PLAN_TIERS:
        tier_slugs = get_tools_for_plan(tier)
        tier_tools = [TOOL_REGISTRY[s] for s in tier_slugs if s in TOOL_REGISTRY]
        tier_installed = sum(1 for t in tier_tools if shutil.which(t.binary))
        plan_stats[tier] = {
            'total': len(tier_tools),
            'installed': tier_installed,
            'missing': len(tier_tools) - tier_installed,
            'coverage': f"{(tier_installed / len(tier_tools) * 100):.0f}%" if tier_tools else '0%',
        }

    summary = {
        'total_tools': total,
        'installed': total - missing_count if not only_missing else None,
        'missing': missing_count,
        'coverage_pct': f"{((total - missing_count) / total * 100):.1f}%" if total else '0%',
        'categories': categories,
        'plan_tiers': plan_stats,
    }

    return results, summary


# ═══════════════════════════════════════════════
#  PRETTY PRINTER
# ═══════════════════════════════════════════════

COLORS = {
    'reset': '\033[0m',
    'bold': '\033[1m',
    'green': '\033[92m',
    'red': '\033[91m',
    'yellow': '\033[93m',
    'cyan': '\033[96m',
    'dim': '\033[2m',
}


def print_report(results: List[Dict], summary: Dict):
    """Print a colorful terminal report."""
    c = COLORS

    print(f"\n{c['bold']}{'═' * 70}")
    print(f"  🛡️  CyberSec Pro — Tool Installation Report")
    print(f"{'═' * 70}{c['reset']}\n")

    current_cat = None
    for r in results:
        if r['category'] != current_cat:
            current_cat = r['category']
            print(f"\n  {c['cyan']}{c['bold']}▸ {current_cat}{c['reset']}")
            print(f"  {'─' * 50}")

        if r['installed']:
            icon = f"{c['green']}✔{c['reset']}"
            path_info = f"{c['dim']}{r['binary_path']}{c['reset']}"
            ver = f"  {c['dim']}{r['version']}{c['reset']}" if r.get('version') else ''
            print(f"    {icon}  {r['name']:<24} {path_info}{ver}")
        else:
            icon = f"{c['red']}✘{c['reset']}"
            plan_badge = f"{c['yellow']}[{r['plan']}]{c['reset']}"
            print(f"    {icon}  {r['name']:<24} {c['red']}NOT FOUND{c['reset']}  {plan_badge}")

    # Summary
    total = summary['total_tools']
    installed = summary.get('installed', 0) or 0
    missing = summary['missing']

    print(f"\n{'═' * 70}")
    print(f"  {c['bold']}SUMMARY{c['reset']}")
    print(f"{'═' * 70}")
    print(f"  Total tools : {total}")
    print(f"  Installed   : {c['green']}{installed}{c['reset']}")
    print(f"  Missing     : {c['red']}{missing}{c['reset']}")
    print(f"  Coverage    : {summary['coverage_pct']}")

    print(f"\n  {c['bold']}Plan Tier Coverage:{c['reset']}")
    for tier, stats in summary['plan_tiers'].items():
        bar_len = 20
        filled = int((stats['installed'] / stats['total']) * bar_len) if stats['total'] else 0
        bar = '█' * filled + '░' * (bar_len - filled)
        color = c['green'] if stats['missing'] == 0 else c['yellow'] if stats['missing'] <= 3 else c['red']
        print(f"    {tier:<14} {color}{bar}{c['reset']}  {stats['installed']}/{stats['total']}  ({stats['coverage']})")

    print(f"\n{'═' * 70}\n")

    if missing > 0:
        print(f"  {c['yellow']}💡 Install missing tools:{c['reset']}")
        missing_tools = [r for r in results if not r['installed']]
        bins = [t['binary'] for t in missing_tools[:10]]
        print(f"     apt install -y {' '.join(bins)}")
        if len(missing_tools) > 10:
            print(f"     ... and {len(missing_tools) - 10} more")
        print()


# ═══════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='CyberSec Pro Tool Verifier')
    parser.add_argument('--json', action='store_true', help='Output JSON')
    parser.add_argument('--plan', type=str, help='Filter by plan tier (trial/starter/professional/enterprise)')
    parser.add_argument('--missing', action='store_true', help='Show only missing tools')
    args = parser.parse_args()

    results, summary = verify_all(
        plan_filter=args.plan,
        only_missing=args.missing,
    )

    if args.json:
        output = {'results': results, 'summary': summary}
        print(json.dumps(output, indent=2, default=str))
    else:
        print_report(results, summary)

    # Exit code: 0 if coverage ≥ 80%, 1 otherwise
    total = summary['total_tools']
    missing = summary['missing']
    if total > 0 and (total - missing) / total < 0.8:
        sys.exit(1)
    sys.exit(0)


if __name__ == '__main__':
    main()
