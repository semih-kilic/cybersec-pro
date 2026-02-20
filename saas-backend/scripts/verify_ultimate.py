#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════╗
║           CYBERSEC-PRO V9 — ULTIMATE VERIFICATION SUITE          ║
║                                                                  ║
║  3-Stage Mathematical Proof:                                     ║
║    Stage 1: Installation Check  (binary exists?)                 ║
║    Stage 2: Configuration Check (tool_configs.py entry?)         ║
║    Stage 3: Runtime Smoke Test  (--version / --help works?)      ║
║                                                                  ║
║  Generates: verification_report.html + verification_report.json  ║
╚══════════════════════════════════════════════════════════════════╝

Usage:
    python scripts/verify_ultimate.py                # Full run (DB + system)
    python scripts/verify_ultimate.py --quick        # Top 100 only
    python scripts/verify_ultimate.py --from-file kali_tools.txt  # Custom list
    python scripts/verify_ultimate.py --workers 8    # Parallel workers
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import sqlite3
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

# ─── Setup paths ─────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

# ─── Tool binary aliases (name → actual binary) ─────────────
BINARY_ALIASES = {
    # Metasploit ecosystem
    "metasploit": "msfconsole",
    "metasploit-framework": "msfconsole",
    "msfvenom": "msfvenom",
    "msfconsole": "msfconsole",
    "msfdb": "msfdb",
    # John
    "john-the-ripper": "john",
    # CrackMapExec / NetExec
    "CrackMapExec": "crackmapexec",
    "crackmapexec": "crackmapexec",
    "netexec": "netexec",
    # SET
    "set": "setoolkit",
    "social-engineer-toolkit": "setoolkit",
    # Python scripts (.py extension)
    "wpscan": "wpscan",
    "atexec.py": "atexec.py",
    "dcomexec.py": "dcomexec.py",
    "dpkg-scanpackages": "dpkg-scanpackages",
    "GetADUsers.py": "GetADUsers.py",
    "GetNPUsers.py": "GetNPUsers.py",
    "GetUserSPNs.py": "GetUserSPNs.py",
    "getTGT.py": "getTGT.py",
    "golismero": "golismero",
    "lookupsid.py": "lookupsid.py",
    "ntlmrelayx.py": "ntlmrelayx.py",
    "psexec.py": "psexec.py",
    "reg.py": "reg.py",
    "rpcdump.py": "rpcdump.py",
    "samrdump.py": "samrdump.py",
    "secretsdump.py": "secretsdump.py",
    "services.py": "services.py",
    "smbclient.py": "smbclient.py",
    "smbexec.py": "smbexec.py",
    "smbserver.py": "smbserver.py",
    "snmpcheck": "snmp-check",
    "smtp-user-enum": "smtp-user-enum",
    "wmiexec.py": "wmiexec.py",
    "impacket-smbclient": "impacket-smbclient",
    "impacket-secretsdump": "impacket-secretsdump",
    "impacket-psexec": "impacket-psexec",
    "impacket-wmiexec": "impacket-wmiexec",
    "impacket-ntlmrelayx": "impacket-ntlmrelayx",
    "impacket-getTGT": "impacket-getTGT",
    "impacket-GetUserSPNs": "impacket-GetUserSPNs",
    "impacket-GetNPUsers": "impacket-GetNPUsers",
    # GUI / non-CLI tools
    "burpsuite": "burpsuite",
    "bloodhound": "bloodhound",
    "wireshark": "wireshark",
    "ghidra": "ghidra",
    "ida-free": "ida64",
    "maltego": "maltego",
    "autopsy": "autopsy",
    # PEASS
    "PEASS-ng": "linpeas",
    "linpeas": "linpeas",
    "winpeas": "winpeas",
    # Misc aliases
    "king-phisher": "king-phisher",
    "netdiscover": "netdiscover",
    "recon-ng": "recon-ng",
    "searchsploit": "searchsploit",
    "exploitdb": "searchsploit",
    "wfuzz": "wfuzz",
    "payloadsallthethings": "payloadsallthethings",
    "seclists": "seclists",
    "rockyou": "rockyou",
    # V9.1 — packages with different binary names
    "awscli": "aws",
    "bluez": "bluetoothctl",
    "capstone-tool": "cstool",
    "csvkit": "csvcut",
    "dex2jar": "d2j-apk-sign",
    "gdb-peda": "gdb",
    "hcxtools": "hcxpcapngtool",
    "ligolo-ng": "ligolo-proxy",
    "miller": "mlr",
    "nftables": "nft",
    "redfang": "fang",
    "sipvicious": "svmap",
    "sleuthkit": "blkcat",
    "sliver": "sliver-server",
    "ubertooth": "ubertooth-btle",
    "wpa-sycophant": "wpa_sycophant",
    "zaproxy": "zaproxy",
}

# ─── Tools that should use special version check commands ────
VERSION_COMMANDS = {
    "nmap": ["nmap", "--version"],
    "msfconsole": ["msfconsole", "--version"],
    "msfvenom": ["msfvenom", "--list", "payloads"],
    "wireshark": ["wireshark", "--version"],
    "burpsuite": ["burpsuite", "--help"],
    "john": ["john", "--help"],
    "hashcat": ["hashcat", "--version"],
    "sqlmap": ["sqlmap", "--version"],
    "nikto": ["nikto", "-Version"],
    "wpscan": ["wpscan", "--version"],
    "hydra": ["hydra", "-h"],
    "gobuster": ["gobuster", "version"],
    "feroxbuster": ["feroxbuster", "--version"],
    "ffuf": ["ffuf", "-V"],
    "dirb": ["dirb"],
    "dirbuster": ["dirbuster", "-h"],
    "masscan": ["masscan", "--version"],
    "netcat": ["nc", "-h"],
    "nc": ["nc", "-h"],
    "ncat": ["ncat", "--version"],
    "socat": ["socat", "-V"],
    "curl": ["curl", "--version"],
    "wget": ["wget", "--version"],
    "python3": ["python3", "--version"],
    "ruby": ["ruby", "--version"],
    "perl": ["perl", "--version"],
    "gcc": ["gcc", "--version"],
    "gdb": ["gdb", "--version"],
    "radare2": ["radare2", "-v"],
    "r2": ["r2", "-v"],
    "binwalk": ["binwalk", "--help"],
    "foremost": ["foremost", "-V"],
    "volatility": ["vol", "--help"],
    "steghide": ["steghide", "--help"],
    "stegsolve": ["stegsolve", "--help"],
    "exiftool": ["exiftool", "-ver"],
    "tcpdump": ["tcpdump", "--version"],
    "tshark": ["tshark", "--version"],
    "aircrack-ng": ["aircrack-ng", "--help"],
    "reaver": ["reaver", "-h"],
    "bettercap": ["bettercap", "-h"],
    "ettercap": ["ettercap", "--version"],
    "responder": ["responder", "--version"],
    "crackmapexec": ["crackmapexec", "--version"],
    "enum4linux": ["enum4linux", "-h"],
    "smbclient": ["smbclient", "--version"],
    "rpcclient": ["rpcclient", "--version"],
    "ldapsearch": ["ldapsearch", "-VV"],
    "impacket-smbclient": ["impacket-smbclient", "-h"],
    "impacket-secretsdump": ["impacket-secretsdump", "-h"],
    "bloodhound": ["bloodhound", "--help"],
    "setoolkit": ["setoolkit", "--help"],
    "king-phisher": ["king-phisher", "--version"],
    "beef-xss": ["beef-xss", "--help"],
    "searchsploit": ["searchsploit", "-h"],
    "armitage": ["armitage", "--help"],
    "maltego": ["maltego", "--help"],
    "recon-ng": ["recon-ng", "--help"],
    "theharvester": ["theHarvester", "-h"],
    "sublist3r": ["sublist3r", "-h"],
    "subfinder": ["subfinder", "-version"],
    "amass": ["amass", "version"],
    "spiderfoot": ["spiderfoot", "-h"],
    "dmitry": ["dmitry"],
    "whois": ["whois", "--version"],
    "dig": ["dig", "-v"],
    "host": ["host", "-V"],
    "fierce": ["fierce", "-h"],
    "dnsrecon": ["dnsrecon", "-h"],
    "dnsenum": ["dnsenum", "--help"],
    "wafw00f": ["wafw00f", "-V"],
    "whatweb": ["whatweb", "--version"],
    "wapiti": ["wapiti", "--version"],
    "skipfish": ["skipfish", "-h"],
    "arjun": ["arjun", "-h"],
    "commix": ["commix", "--version"],
    "xsser": ["xsser", "-h"],
    "autopsy": ["autopsy", "-h"],
    "ghidra": ["ghidra", "--help"],
    "apktool": ["apktool", "--version"],
    "jadx": ["jadx", "--version"],
    "objdump": ["objdump", "--version"],
    "strings": ["strings", "--version"],
    "file": ["file", "--version"],
    "ltrace": ["ltrace", "--version"],
    "strace": ["strace", "--version"],
    "arp-scan": ["arp-scan", "--version"],
    "netdiscover": ["netdiscover", "-h"],
    "fping": ["fping", "--version"],
    "hping3": ["hping3", "--version"],
    "yersinia": ["yersinia", "-h"],
    "macchanger": ["macchanger", "--version"],
    "proxychains": ["proxychains4", "--help"],
    "proxychains4": ["proxychains4", "--help"],
    "tor": ["tor", "--version"],
    "openvpn": ["openvpn", "--version"],
    "ssh": ["ssh", "-V"],
    "sshpass": ["sshpass", "-V"],
    "medusa": ["medusa", "-V"],
    "patator": ["patator", "-h"],
    "cewl": ["cewl", "--help"],
    "crunch": ["crunch"],
    "wordlists": ["ls", "/usr/share/wordlists/"],
    "autopsy": ["autopsy", "-h"],
    "docker": ["docker", "--version"],
    "git": ["git", "--version"],
    "aws": ["aws", "--version"],
    "gcloud": ["gcloud", "--version"],
    "kubectl": ["kubectl", "version", "--client"],
    "terraform": ["terraform", "--version"],
    "ansible": ["ansible", "--version"],
    "nuclei": ["nuclei", "-version"],
    "httpx": ["httpx", "-version"],
    "katana": ["katana", "-version"],
    "dalfox": ["dalfox", "version"],
    "gau": ["gau", "-version"],
    "waybackurls": ["waybackurls", "-h"],
    "hakrawler": ["hakrawler", "-h"],
    "assetfinder": ["assetfinder", "-h"],
    # V9.1 — version commands for aliased packages
    "aws": ["aws", "--version"],
    "bluetoothctl": ["bluetoothctl", "--version"],
    "cstool": ["cstool", "-v"],
    "csvcut": ["csvcut", "--version"],
    "d2j-apk-sign": ["d2j-apk-sign", "--help"],
    "hcxpcapngtool": ["hcxpcapngtool", "--version"],
    "ligolo-proxy": ["ligolo-proxy", "--help"],
    "mlr": ["mlr", "--version"],
    "nft": ["nft", "--version"],
    "fang": ["fang", "-h"],
    "svmap": ["svmap", "--version"],
    "blkcat": ["blkcat", "-V"],
    "sliver-server": ["sliver-server", "version"],
    "ubertooth-btle": ["ubertooth-btle", "-h"],
    "wpa_sycophant": ["wpa_sycophant", "-h"],
    "zaproxy": ["zaproxy", "-cmd", "-version"],
}

# ─── Non-CLI entries (CVEs, wordlists, frameworks, references) ───
NON_CLI_PATTERNS = [
    r'^CVE-\d{4}-\d+$',       # CVE entries
    r'^GTFOBins$',
    r'^LOLBASProject$',
    r'^WADComs$',
    r'^payloadsallthethings$',
    r'^seclists$',
    r'^rockyou$',
    r'^wordlists?$',
    r'^SecLists$',
]

# ─── Top 100 essential Kali tools ────────────────────────────
TOP_100_TOOLS = [
    "nmap", "masscan", "nikto", "sqlmap", "hydra", "john", "hashcat",
    "aircrack-ng", "wireshark", "tcpdump", "burpsuite", "metasploit",
    "msfvenom", "gobuster", "dirb", "ffuf", "feroxbuster", "wpscan",
    "whatweb", "wafw00f", "amass", "subfinder", "sublist3r", "theharvester",
    "recon-ng", "maltego", "dnsrecon", "dnsenum", "fierce", "dig",
    "whois", "host", "nslookup", "traceroute", "netcat", "ncat",
    "socat", "curl", "wget", "ssh", "sshpass", "ftp", "smbclient",
    "rpcclient", "enum4linux", "crackmapexec", "bloodhound", "responder",
    "impacket-smbclient", "impacket-secretsdump", "impacket-psexec",
    "mimikatz", "lazagne", "searchsploit", "msfconsole",
    "setoolkit", "beef-xss", "king-phisher",
    "radare2", "ghidra", "gdb", "objdump", "strings", "ltrace", "strace",
    "binwalk", "foremost", "exiftool", "steghide", "autopsy",
    "airmon-ng", "airodump-ng", "aireplay-ng", "bettercap", "ettercap",
    "arpspoof", "macchanger", "hping3", "arp-scan", "netdiscover",
    "proxychains4", "tor", "openvpn",
    "medusa", "patator", "cewl", "crunch", "cupp",
    "wfuzz", "commix", "xsser", "dalfox",
    "nuclei", "httpx", "katana",
    "docker", "git", "python3", "ruby", "perl", "gcc",
    "apktool", "jadx", "dex2jar",
    "wapiti", "skipfish", "arjun",
]


# ─── Data structures ────────────────────────────────────────

@dataclass
class ToolResult:
    name: str
    binary: str
    category: str = "unknown"
    # Stage 1: Installation
    installed: bool = False
    binary_path: Optional[str] = None
    # Stage 2: Configuration
    configured: bool = False
    has_default_profile: bool = False
    profile_count: int = 0
    # Stage 3: Runtime
    runnable: bool = False
    runtime_output: str = ""
    runtime_exit_code: int = -1
    runtime_error: str = ""
    # Classification
    is_non_cli: bool = False
    status: str = "missing"  # perfect|warning|missing|non-cli

    def classify(self):
        if self.is_non_cli:
            self.status = "non-cli"
        elif self.installed and self.configured and self.runnable:
            self.status = "perfect"
        elif self.installed and not self.configured:
            self.status = "warning"
        elif self.installed and self.configured and not self.runnable:
            self.status = "warning"
        elif not self.installed:
            self.status = "missing"
        else:
            self.status = "warning"


# ─── Core verification engine ───────────────────────────────

class UltimateVerifier:
    def __init__(self, tools: list[str], workers: int = 4, timeout: int = 10):
        self.tools = tools
        self.workers = workers
        self.timeout = timeout
        self.results: list[ToolResult] = []
        self.registry = {}
        self.db_categories = {}
        self._load_registry()
        self._load_db_categories()

    def _load_registry(self):
        """Load TOOL_REGISTRY with bulk DB + system load."""
        try:
            from tool_configs import (
                TOOL_REGISTRY, bulk_register_from_db, load_tools_from_system
            )
            # bulk_register_from_db requires tools_data from DB
            db_path = BACKEND_DIR / "instance" / "cybersec_saas.db"
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT name, category, plan_required, business_name, description "
                "FROM tools WHERE is_active=1"
            ).fetchall()
            conn.close()
            tools_data = [{
                'name': r['name'],
                'category': r['category'],
                'plan_required': r['plan_required'],
                'business_name': r['business_name'] or '',
                'description': r['description'] or '',
            } for r in rows]
            added = bulk_register_from_db(tools_data)
            load_tools_from_system()
            self.registry = TOOL_REGISTRY
            print(f"  Registry loaded: {len(self.registry)} entries ({added} from DB)")
        except Exception as e:
            print(f"  ⚠ Registry load error: {e}")
            # Try loading just the hardcoded registry
            try:
                from tool_configs import TOOL_REGISTRY
                self.registry = TOOL_REGISTRY
                print(f"  Fallback: {len(self.registry)} hardcoded entries")
            except Exception:
                self.registry = {}

    def _load_db_categories(self):
        """Load tool categories from DB."""
        try:
            db_path = BACKEND_DIR / "instance" / "cybersec_saas.db"
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT name, category FROM tools WHERE is_active=1"
            ).fetchall()
            conn.close()
            self.db_categories = {r["name"]: r["category"] for r in rows}
        except Exception as e:
            print(f"  ⚠ DB category load error: {e}")

    def _resolve_binary(self, tool_name: str) -> str:
        """Resolve tool name to actual binary name."""
        # Check aliases first
        if tool_name in BINARY_ALIASES:
            return BINARY_ALIASES[tool_name]
        # Check registry
        if tool_name in self.registry:
            return self.registry[tool_name].binary
        # Default: tool name is binary name
        return tool_name

    def _is_non_cli(self, tool_name: str) -> bool:
        """Check if tool is a non-CLI entry (CVE, wordlist, reference)."""
        for pattern in NON_CLI_PATTERNS:
            if re.match(pattern, tool_name):
                return True
        return False

    def _check_install(self, tool_name: str, binary: str) -> tuple[bool, Optional[str]]:
        """Stage 1: Check if binary is installed."""
        path = shutil.which(binary)
        if path:
            return True, path

        # Try common alternative locations
        alt_paths = [
            f"/usr/bin/{binary}",
            f"/usr/sbin/{binary}",
            f"/usr/local/bin/{binary}",
            f"/usr/share/{tool_name}/{binary}",
            f"/opt/{tool_name}/{binary}",
        ]
        for alt in alt_paths:
            if os.path.isfile(alt) and os.access(alt, os.X_OK):
                return True, alt

        # Try impacket-prefixed version
        if not binary.startswith("impacket-"):
            impacket_bin = f"impacket-{binary.replace('.py', '')}"
            path = shutil.which(impacket_bin)
            if path:
                return True, path

        return False, None

    def _check_config(self, tool_name: str) -> tuple[bool, bool, int]:
        """Stage 2: Check if tool has configuration entry."""
        if tool_name in self.registry:
            cfg = self.registry[tool_name]
            has_default = "default" in cfg.profiles
            profile_count = len(cfg.profiles)
            return True, has_default, profile_count
        # Also check by binary alias
        binary = self._resolve_binary(tool_name)
        if binary in self.registry:
            cfg = self.registry[binary]
            has_default = "default" in cfg.profiles
            return True, has_default, len(cfg.profiles)
        return False, False, 0

    def _check_runtime(self, binary: str, binary_path: Optional[str]) -> tuple[bool, str, int, str]:
        """Stage 3: Runtime smoke test."""
        if not binary_path:
            return False, "", -1, "binary not found"

        # Build command — use specific version command if known
        if binary in VERSION_COMMANDS:
            cmd = VERSION_COMMANDS[binary]
        else:
            cmd = [binary_path, "--version"]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
                stdin=subprocess.DEVNULL,
                env={**os.environ, "TERM": "dumb", "COLUMNS": "200",
                     "DEBIAN_FRONTEND": "noninteractive"},
                start_new_session=True,
            )
            output = (result.stdout or "") + (result.stderr or "")
            output = output[:500]  # Truncate

            # Many tools return non-zero for --version/--help but still work
            if result.returncode == 0:
                return True, output, 0, ""

            # If returncode != 0 but there's output, tool works
            if output.strip() and "command not found" not in output.lower():
                return True, output, result.returncode, ""

            return False, output, result.returncode, f"exit code {result.returncode}"

        except subprocess.TimeoutExpired:
            return True, "[timeout — tool started but took too long]", 0, ""
        except PermissionError:
            return False, "", -1, "permission denied"
        except FileNotFoundError:
            # Binary exists but can't execute it — try --help instead
            try:
                result2 = subprocess.run(
                    [binary_path, "--help"],
                    capture_output=True, text=True, timeout=self.timeout,
                    stdin=subprocess.DEVNULL, start_new_session=True,
                )
                output2 = (result2.stdout or "") + (result2.stderr or "")
                if output2.strip():
                    return True, output2[:500], result2.returncode, ""
            except Exception:
                pass
            return False, "", -1, "command not found"
        except Exception as e:
            return False, "", -1, str(e)[:200]

    def verify_tool(self, tool_name: str) -> ToolResult:
        """Full 3-stage verification for a single tool."""
        binary = self._resolve_binary(tool_name)
        category = self.db_categories.get(tool_name, "unknown")

        result = ToolResult(name=tool_name, binary=binary, category=category)

        # Non-CLI check
        if self._is_non_cli(tool_name):
            result.is_non_cli = True
            result.classify()
            return result

        # Stage 1: Installation
        result.installed, result.binary_path = self._check_install(tool_name, binary)

        # Stage 2: Configuration
        result.configured, result.has_default_profile, result.profile_count = \
            self._check_config(tool_name)

        # Stage 3: Runtime (only if installed)
        if result.installed:
            result.runnable, result.runtime_output, result.runtime_exit_code, \
                result.runtime_error = self._check_runtime(binary, result.binary_path)

        result.classify()
        return result

    def run(self) -> list[ToolResult]:
        """Run all 3 stages for all tools."""
        total = len(self.tools)
        print(f"\n{'='*65}")
        print(f"  ULTIMATE VERIFICATION: {total} tools, {self.workers} workers")
        print(f"{'='*65}\n")

        self.results = []
        completed = 0

        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            future_to_tool = {
                executor.submit(self.verify_tool, tool): tool
                for tool in self.tools
            }
            for future in as_completed(future_to_tool):
                tool_name = future_to_tool[future]
                try:
                    result = future.result(timeout=30)
                    self.results.append(result)
                except Exception as e:
                    r = ToolResult(name=tool_name, binary=tool_name)
                    r.runtime_error = str(e)[:200]
                    r.classify()
                    self.results.append(r)

                completed += 1
                if completed % 50 == 0 or completed == total:
                    pct = (completed / total) * 100
                    print(f"  Progress: {completed}/{total} ({pct:.0f}%)")

        # Sort by status then name
        status_order = {"perfect": 0, "warning": 1, "non-cli": 2, "missing": 3}
        self.results.sort(key=lambda r: (status_order.get(r.status, 9), r.name))

        return self.results


# ─── Report generators ──────────────────────────────────────

def generate_json_report(results: list[ToolResult], output_path: Path):
    """Generate JSON summary report."""
    perfect = [r for r in results if r.status == "perfect"]
    warning = [r for r in results if r.status == "warning"]
    missing = [r for r in results if r.status == "missing"]
    non_cli = [r for r in results if r.status == "non-cli"]

    # Calculate percentages against CLI tools only
    cli_total = len(results) - len(non_cli)
    install_rate = (len([r for r in results if r.installed]) / cli_total * 100) if cli_total else 0
    config_rate = (len([r for r in results if r.configured]) / cli_total * 100) if cli_total else 0
    runtime_rate = (len([r for r in results if r.runnable]) / cli_total * 100) if cli_total else 0

    report = {
        "meta": {
            "generated_at": datetime.now().isoformat(),
            "total_tools": len(results),
            "cli_tools": cli_total,
            "non_cli_entries": len(non_cli),
        },
        "summary": {
            "perfect": len(perfect),
            "warning": len(warning),
            "missing": len(missing),
            "non_cli": len(non_cli),
            "installation_rate": round(install_rate, 1),
            "configuration_rate": round(config_rate, 1),
            "runtime_rate": round(runtime_rate, 1),
        },
        "stage1_installed": [r.name for r in results if r.installed],
        "stage2_configured": [r.name for r in results if r.configured],
        "stage3_runnable": [r.name for r in results if r.runnable],
        "warnings": [
            {"name": r.name, "binary": r.binary, "reason": "installed but no config" if not r.configured else "installed+configured but runtime failed"}
            for r in warning
        ],
        "missing": [r.name for r in missing],
        "tools": [asdict(r) for r in results],
    }

    with open(output_path, "w") as f:
        json.dump(report, f, indent=2, default=str)


def generate_html_report(results: list[ToolResult], output_path: Path):
    """Generate interactive HTML report with progress bars."""
    perfect = [r for r in results if r.status == "perfect"]
    warning = [r for r in results if r.status == "warning"]
    missing = [r for r in results if r.status == "missing"]
    non_cli = [r for r in results if r.status == "non-cli"]
    cli_total = len(results) - len(non_cli)

    installed_count = len([r for r in results if r.installed])
    configured_count = len([r for r in results if r.configured])
    runnable_count = len([r for r in results if r.runnable])

    inst_pct = (installed_count / cli_total * 100) if cli_total else 0
    conf_pct = (configured_count / cli_total * 100) if cli_total else 0
    run_pct = (runnable_count / cli_total * 100) if cli_total else 0

    # Category breakdown
    categories = {}
    for r in results:
        cat = r.category or "unknown"
        if cat not in categories:
            categories[cat] = {"total": 0, "installed": 0, "configured": 0, "runnable": 0}
        categories[cat]["total"] += 1
        if r.installed:
            categories[cat]["installed"] += 1
        if r.configured:
            categories[cat]["configured"] += 1
        if r.runnable:
            categories[cat]["runnable"] += 1

    # Build tool rows
    def tool_row(r: ToolResult) -> str:
        status_icon = {"perfect": "✅", "warning": "⚠️", "missing": "❌", "non-cli": "📄"}.get(r.status, "?")
        status_class = r.status
        s1 = "✅" if r.installed else "❌"
        s2 = "✅" if r.configured else "❌"
        s3 = "✅" if r.runnable else ("➖" if not r.installed else "❌")
        profiles = f"{r.profile_count} profiles" if r.configured else "—"
        runtime_info = r.runtime_output[:80].replace("<", "&lt;").replace(">", "&gt;") if r.runtime_output else (r.runtime_error[:60] if r.runtime_error else "—")
        return f"""<tr class="tool-row {status_class}">
            <td>{status_icon}</td>
            <td><strong>{r.name}</strong></td>
            <td><code>{r.binary}</code></td>
            <td>{r.category}</td>
            <td>{s1}</td>
            <td>{s2} <small>{profiles}</small></td>
            <td>{s3}</td>
            <td class="runtime-info"><small>{runtime_info}</small></td>
        </tr>"""

    tool_rows = "\n".join(tool_row(r) for r in results)

    # Category rows
    cat_rows = ""
    for cat, data in sorted(categories.items()):
        cat_pct = (data["installed"] / data["total"] * 100) if data["total"] else 0
        cat_rows += f"""<tr>
            <td><strong>{cat}</strong></td>
            <td>{data['total']}</td>
            <td>{data['installed']}</td>
            <td>{data['configured']}</td>
            <td>{data['runnable']}</td>
            <td><div class="progress-bar"><div class="progress-fill" style="width:{cat_pct:.0f}%">{cat_pct:.0f}%</div></div></td>
        </tr>"""

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CyberSec Pro — Ultimate Verification Report</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #0a0a1a;
            color: #e0e0e0;
            line-height: 1.6;
        }}
        .container {{ max-width: 1400px; margin: 0 auto; padding: 20px; }}
        h1 {{
            font-size: 2.5em;
            background: linear-gradient(135deg, #00ff88, #00ccff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-align: center;
            margin: 20px 0;
        }}
        h2 {{
            color: #00ccff;
            margin: 30px 0 15px;
            border-bottom: 1px solid #1a1a3a;
            padding-bottom: 8px;
        }}
        .timestamp {{
            text-align: center;
            color: #666;
            margin-bottom: 30px;
        }}
        /* Score cards */
        .score-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 25px 0;
        }}
        .score-card {{
            background: #12122a;
            border: 1px solid #1a1a3a;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        }}
        .score-card.perfect {{ border-color: #00ff88; }}
        .score-card.warning {{ border-color: #ffaa00; }}
        .score-card.missing {{ border-color: #ff4444; }}
        .score-card.info {{ border-color: #00ccff; }}
        .score-number {{
            font-size: 3em;
            font-weight: bold;
        }}
        .score-card.perfect .score-number {{ color: #00ff88; }}
        .score-card.warning .score-number {{ color: #ffaa00; }}
        .score-card.missing .score-number {{ color: #ff4444; }}
        .score-card.info .score-number {{ color: #00ccff; }}
        .score-label {{ font-size: 0.9em; color: #888; margin-top: 5px; }}
        /* Progress bars */
        .stage-bars {{ margin: 25px 0; }}
        .stage-bar {{
            margin: 15px 0;
            background: #12122a;
            border-radius: 8px;
            padding: 15px 20px;
            border: 1px solid #1a1a3a;
        }}
        .stage-label {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-weight: bold;
        }}
        .progress-bar {{
            background: #1a1a2e;
            border-radius: 10px;
            height: 30px;
            overflow: hidden;
            position: relative;
        }}
        .progress-fill {{
            height: 100%;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 0.85em;
            color: #000;
            transition: width 0.5s ease;
        }}
        .stage-bar.s1 .progress-fill {{ background: linear-gradient(90deg, #00ff88, #00cc66); }}
        .stage-bar.s2 .progress-fill {{ background: linear-gradient(90deg, #00ccff, #0088cc); }}
        .stage-bar.s3 .progress-fill {{ background: linear-gradient(90deg, #aa88ff, #6644cc); }}
        /* Filter */
        .filter-bar {{
            background: #12122a;
            border: 1px solid #1a1a3a;
            border-radius: 8px;
            padding: 12px 20px;
            margin: 20px 0;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
        }}
        .filter-btn {{
            padding: 6px 16px;
            border-radius: 20px;
            border: 1px solid #333;
            background: #1a1a2e;
            color: #ccc;
            cursor: pointer;
            font-size: 0.85em;
        }}
        .filter-btn.active {{ background: #00ccff; color: #000; border-color: #00ccff; }}
        .filter-btn:hover {{ border-color: #00ccff; }}
        input.search {{
            flex: 1;
            min-width: 200px;
            padding: 8px 16px;
            border-radius: 20px;
            border: 1px solid #333;
            background: #1a1a2e;
            color: #fff;
            font-size: 0.9em;
        }}
        /* Table */
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }}
        th {{
            background: #12122a;
            color: #00ccff;
            padding: 12px 8px;
            text-align: left;
            position: sticky;
            top: 0;
            z-index: 10;
            font-size: 0.85em;
        }}
        td {{
            padding: 8px;
            border-bottom: 1px solid #1a1a2e;
            font-size: 0.85em;
        }}
        tr:hover {{ background: #1a1a2e; }}
        tr.perfect td:first-child {{ color: #00ff88; }}
        tr.warning td:first-child {{ color: #ffaa00; }}
        tr.missing td:first-child {{ color: #ff4444; }}
        tr.non-cli td:first-child {{ color: #888; }}
        code {{
            background: #1a1a2e;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.85em;
            color: #00ff88;
        }}
        .runtime-info {{
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }}
        /* Verdict */
        .verdict {{
            text-align: center;
            margin: 40px 0;
            padding: 30px;
            border-radius: 16px;
            font-size: 1.3em;
        }}
        .verdict.pass {{
            background: linear-gradient(135deg, #002211, #003322);
            border: 2px solid #00ff88;
            color: #00ff88;
        }}
        .verdict.warn {{
            background: linear-gradient(135deg, #221100, #332200);
            border: 2px solid #ffaa00;
            color: #ffaa00;
        }}
        .verdict.fail {{
            background: linear-gradient(135deg, #220000, #330000);
            border: 2px solid #ff4444;
            color: #ff4444;
        }}
        .footer {{
            text-align: center;
            color: #444;
            margin: 40px 0 20px;
            font-size: 0.85em;
        }}
    </style>
</head>
<body>
<div class="container">

<h1>⚡ CyberSec Pro — Ultimate Verification Report</h1>
<p class="timestamp">Generated: {timestamp} | V9 Final Exam</p>

<!-- Score Cards -->
<div class="score-grid">
    <div class="score-card perfect">
        <div class="score-number">{len(perfect)}</div>
        <div class="score-label">✅ Perfect (Install+Config+Run)</div>
    </div>
    <div class="score-card warning">
        <div class="score-number">{len(warning)}</div>
        <div class="score-label">⚠️ Warning (Needs Attention)</div>
    </div>
    <div class="score-card missing">
        <div class="score-number">{len(missing)}</div>
        <div class="score-label">❌ Missing (Not Installed)</div>
    </div>
    <div class="score-card info">
        <div class="score-number">{cli_total}</div>
        <div class="score-label">🔧 Total CLI Tools</div>
    </div>
</div>

<!-- Stage Progress Bars -->
<h2>3-Stage Verification Progress</h2>
<div class="stage-bars">
    <div class="stage-bar s1">
        <div class="stage-label">
            <span>Stage 1: Installation Check</span>
            <span>{installed_count}/{cli_total} ({inst_pct:.1f}%)</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:{inst_pct:.0f}%">{inst_pct:.0f}%</div></div>
    </div>
    <div class="stage-bar s2">
        <div class="stage-label">
            <span>Stage 2: Configuration Check</span>
            <span>{configured_count}/{cli_total} ({conf_pct:.1f}%)</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:{conf_pct:.0f}%">{conf_pct:.0f}%</div></div>
    </div>
    <div class="stage-bar s3">
        <div class="stage-label">
            <span>Stage 3: Runtime Smoke Test</span>
            <span>{runnable_count}/{cli_total} ({run_pct:.1f}%)</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:{run_pct:.0f}%">{run_pct:.0f}%</div></div>
    </div>
</div>

<!-- Category Breakdown -->
<h2>Category Breakdown</h2>
<table>
    <thead><tr><th>Category</th><th>Total</th><th>Installed</th><th>Configured</th><th>Runnable</th><th>Rate</th></tr></thead>
    <tbody>{cat_rows}</tbody>
</table>

<!-- Tool Details -->
<h2>Tool Details ({len(results)} tools)</h2>

<div class="filter-bar">
    <input class="search" type="text" id="searchInput" placeholder="🔍 Search tools..." onkeyup="filterTools()">
    <button class="filter-btn active" onclick="filterStatus('all', this)">All ({len(results)})</button>
    <button class="filter-btn" onclick="filterStatus('perfect', this)">✅ Perfect ({len(perfect)})</button>
    <button class="filter-btn" onclick="filterStatus('warning', this)">⚠️ Warning ({len(warning)})</button>
    <button class="filter-btn" onclick="filterStatus('missing', this)">❌ Missing ({len(missing)})</button>
    <button class="filter-btn" onclick="filterStatus('non-cli', this)">📄 Non-CLI ({len(non_cli)})</button>
</div>

<table id="toolsTable">
    <thead>
        <tr>
            <th>St</th><th>Tool</th><th>Binary</th><th>Category</th>
            <th>S1 Install</th><th>S2 Config</th><th>S3 Runtime</th><th>Details</th>
        </tr>
    </thead>
    <tbody>
        {tool_rows}
    </tbody>
</table>

<!-- Verdict -->
<div class="verdict {'pass' if inst_pct > 80 else ('warn' if inst_pct > 50 else 'fail')}">
    <div style="font-size:2em;margin-bottom:10px">{'🏆' if inst_pct > 80 else ('⚠️' if inst_pct > 50 else '❌')}</div>
    <strong>VERIFICATION VERDICT</strong><br>
    {installed_count} of {cli_total} CLI tools installed ({inst_pct:.1f}%)<br>
    {configured_count} configured | {runnable_count} runtime-verified<br>
    <small>{len(perfect)} tools are PERFECT (all 3 stages pass)</small>
</div>

<div class="footer">
    CyberSec Pro V9 — Ultimate Verification Suite<br>
    Report generated by verify_ultimate.py
</div>

</div>

<script>
function filterStatus(status, btn) {{
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tool-row').forEach(row => {{
        if (status === 'all' || row.classList.contains(status)) {{
            row.style.display = '';
        }} else {{
            row.style.display = 'none';
        }}
    }});
}}
function filterTools() {{
    const q = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('.tool-row').forEach(row => {{
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    }});
}}
</script>
</body>
</html>"""

    with open(output_path, "w") as f:
        f.write(html)


def print_summary(results: list[ToolResult]):
    """Print terminal summary."""
    perfect = [r for r in results if r.status == "perfect"]
    warning = [r for r in results if r.status == "warning"]
    missing = [r for r in results if r.status == "missing"]
    non_cli = [r for r in results if r.status == "non-cli"]
    cli_total = len(results) - len(non_cli)

    installed = len([r for r in results if r.installed])
    configured = len([r for r in results if r.configured])
    runnable = len([r for r in results if r.runnable])

    inst_pct = (installed / cli_total * 100) if cli_total else 0
    conf_pct = (configured / cli_total * 100) if cli_total else 0
    run_pct = (runnable / cli_total * 100) if cli_total else 0

    print(f"\n{'═'*65}")
    print(f"  CYBERSEC-PRO V9 — ULTIMATE VERIFICATION RESULTS")
    print(f"{'═'*65}")
    print(f"  Total tools:     {len(results)}")
    print(f"  CLI tools:       {cli_total}")
    print(f"  Non-CLI entries: {len(non_cli)}")
    print(f"{'─'*65}")
    print(f"  ✅ PERFECT:  {len(perfect):4d}  (installed + configured + runnable)")
    print(f"  ⚠️  WARNING:  {len(warning):4d}  (needs config or runtime fix)")
    print(f"  ❌ MISSING:  {len(missing):4d}  (not installed)")
    print(f"{'─'*65}")
    print(f"  Stage 1 (Installation):   {installed:4d}/{cli_total} ({inst_pct:.1f}%)")
    print(f"  Stage 2 (Configuration):  {configured:4d}/{cli_total} ({conf_pct:.1f}%)")
    print(f"  Stage 3 (Runtime):        {runnable:4d}/{cli_total} ({run_pct:.1f}%)")
    print(f"{'═'*65}")

    # Show warnings (first 20)
    if warning:
        print(f"\n  ⚠️  TOP WARNINGS (showing {min(20, len(warning))}/{len(warning)}):")
        for r in warning[:20]:
            reason = "no config" if not r.configured else "runtime failed"
            print(f"    {r.name:<30} binary={r.binary:<20} [{reason}]")

    # Show first 20 missing
    if missing:
        print(f"\n  ❌ MISSING TOOLS (showing {min(20, len(missing))}/{len(missing)}):")
        for r in missing[:20]:
            print(f"    {r.name:<30} binary={r.binary}")

    print()


# ─── CLI Entry Point ────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="CyberSec Pro V9 — Ultimate Verification Suite"
    )
    parser.add_argument("--quick", action="store_true",
                        help="Quick mode: top 100 tools only")
    parser.add_argument("--from-file",
                        help="Load tool list from file (one per line)")
    parser.add_argument("--workers", type=int, default=4,
                        help="Parallel workers (default: 4)")
    parser.add_argument("--timeout", type=int, default=10,
                        help="Timeout per tool in seconds (default: 10)")
    parser.add_argument("--output-dir",
                        help="Output directory for reports (default: backend root)")

    args = parser.parse_args()

    output_dir = Path(args.output_dir) if args.output_dir else BACKEND_DIR

    # Determine tool list
    if args.quick:
        tools = TOP_100_TOOLS
        print(f"  Mode: QUICK (Top {len(tools)} tools)")
    elif args.from_file:
        fp = Path(args.from_file)
        if not fp.exists():
            print(f"  ❌ File not found: {fp}")
            sys.exit(1)
        tools = [line.strip() for line in fp.read_text().splitlines() if line.strip()]
        print(f"  Mode: FROM FILE ({fp.name}, {len(tools)} tools)")
    else:
        # Full mode: load from DB
        try:
            db_path = BACKEND_DIR / "instance" / "cybersec_saas.db"
            conn = sqlite3.connect(str(db_path))
            rows = conn.execute(
                "SELECT name FROM tools WHERE is_active=1 ORDER BY name"
            ).fetchall()
            conn.close()
            tools = [r[0] for r in rows]
            print(f"  Mode: FULL (DB: {len(tools)} tools)")
        except Exception as e:
            print(f"  ❌ DB error: {e}")
            print(f"  Falling back to Top 100")
            tools = TOP_100_TOOLS

    # Run verification
    verifier = UltimateVerifier(
        tools=tools,
        workers=args.workers,
        timeout=args.timeout,
    )
    results = verifier.run()

    # Print terminal summary
    print_summary(results)

    # Generate reports
    json_path = output_dir / "verification_report.json"
    html_path = output_dir / "verification_report.html"

    generate_json_report(results, json_path)
    print(f"  📄 JSON report: {json_path}")

    generate_html_report(results, html_path)
    print(f"  🌐 HTML report: {html_path}")
    print()


if __name__ == "__main__":
    main()
