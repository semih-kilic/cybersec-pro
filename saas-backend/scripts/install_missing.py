#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║        CYBERSEC-PRO V10 — MISSING TOOLS INSTALLER            ║
║                                                              ║
║  Intelligent multi-strategy tool installer:                  ║
║    A. APT packages  (Kali repo first)                        ║
║    B. Python PIP     (pip3 install)                           ║
║    C. Go tools       (go install)                             ║
║    D. Git clones     (last resort, /opt/tools)               ║
║                                                              ║
║  Usage:                                                      ║
║    sudo python3 scripts/install_missing.py                   ║
║    sudo python3 scripts/install_missing.py --dry-run         ║
║    sudo python3 scripts/install_missing.py --verify          ║
╚══════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

# ─────────────────────────────────────────
# Package name mapping (tool → apt package)
# ─────────────────────────────────────────
PACKAGE_MAP = {
    # Network Scanning
    "nmap": "nmap", "masscan": "masscan", "zmap": "zmap",
    "arp-scan": "arp-scan", "netdiscover": "netdiscover",
    "fping": "fping", "hping3": "hping3",
    "naabu": "naabu", "dnsx": "dnsx",
    # Vuln Assessment
    "nikto": "nikto", "wapiti": "wapiti", "nuclei": "nuclei",
    "whatweb": "whatweb", "wafw00f": "wafw00f",
    "sqlmap": "sqlmap", "commix": "commix",
    # Web Fuzzing
    "gobuster": "gobuster", "dirb": "dirb", "dirsearch": "dirsearch",
    "ffuf": "ffuf", "feroxbuster": "feroxbuster", "wfuzz": "wfuzz",
    "arjun": "arjun",
    # Password
    "hydra": "hydra", "john": "john", "hashcat": "hashcat",
    "medusa": "medusa", "crunch": "crunch", "cewl": "cewl",
    "cupp": "cupp", "crowbar": "crowbar", "brutespray": "brutespray",
    "patator": "patator",
    # Recon / OSINT
    "subfinder": "subfinder", "sublist3r": "sublist3r",
    "amass": "amass", "theharvester": "theharvester",
    "fierce": "fierce", "dnsrecon": "dnsrecon", "dnsenum": "dnsenum",
    "whois": "whois", "recon-ng": "recon-ng",
    "assetfinder": "assetfinder", "httprobe": "httprobe",
    "massdns": "massdns", "dnstwist": "dnstwist",
    "altdns": "altdns", "findomain": "findomain",
    "getallurls": "getallurls", "gospider": "gospider",
    "knockpy": "knockpy", "sherlock": "sherlock",
    "emailharvester": "emailharvester",
    "linkedin2username": "linkedin2username",
    "photon": "photon", "paramspider": "paramspider",
    "spiderfoot": "spiderfoot",
    # Exploitation
    "metasploit-framework": "metasploit-framework",
    "searchsploit": "exploitdb", "exploitdb": "exploitdb",
    "sqlmap": "sqlmap", "commix": "commix",
    "responder": "responder",
    # Wireless
    "aircrack-ng": "aircrack-ng", "bettercap": "bettercap",
    "reaver": "reaver", "bully": "bully",
    "wifite": "wifite", "eaphammer": "eaphammer",
    "wifipumpkin3": "wifipumpkin3", "hcxtools": "hcxtools",
    "ubertooth": "ubertooth",
    # Forensics
    "binwalk": "binwalk", "foremost": "foremost",
    "sleuthkit": "sleuthkit", "exiftool": "libimage-exiftool-perl",
    "steghide": "steghide", "stegseek": "stegseek",
    "volatility": "volatility3",
    # Reverse Engineering
    "radare2": "radare2", "ghidra": "ghidra",
    "gdb": "gdb", "apktool": "apktool",
    "jadx": "jadx", "dex2jar": "dex2jar",
    "objdump": "binutils", "strings": "binutils",
    # Network Tools
    "tcpdump": "tcpdump", "tshark": "tshark",
    "wireshark": "wireshark", "ettercap": "ettercap-text-only",
    "macchanger": "macchanger", "yersinia": "yersinia",
    "mtr": "mtr-tiny", "iftop": "iftop",
    "nethogs": "nethogs", "vnstat": "vnstat",
    "nload": "nload", "iperf3": "iperf3",
    "tor": "tor", "proxychains4": "proxychains4",
    "openvpn": "openvpn", "sshuttle": "sshuttle",
    "socat": "socat", "ncat": "ncat",
    "rlwrap": "rlwrap", "sshpass": "sshpass",
    "autossh": "autossh",
    # Cloud / C2
    "awscli": "awscli", "terraform": "terraform",
    "sliver": "sliver", "havoc": "havoc",
    "silenttrinity": "silenttrinity",
    "evilginx2": "evilginx2",
    # Container/Infra
    "trivy": "trivy", "lynis": "lynis",
    "checksec": "checksec",
    # Misc
    "gitleaks": "gitleaks", "trufflehog": "trufflehog",
    "ropper": "ropper", "patchelf": "patchelf",
    "pwncat": "pwncat", "s3scanner": "s3scanner",
    "proxify": "proxify", "pspy": "pspy", "pup": "pup",
    "html2text": "html2text", "goaccess": "goaccess",
    "speedtest-cli": "speedtest-cli", "lnav": "lnav",
    "mosh": "mosh", "wavemon": "wavemon",
    "xmlstarlet": "xmlstarlet", "gron": "gron",
    "bmon": "bmon", "cbm": "cbm",
    "nuttcp": "nuttcp", "packeth": "packeth",
    "gowitness": "gowitness",
    "dasel": "dasel", "miller": "miller",
    "name-that-hash": "name-that-hash",
    "h8mail": "h8mail", "subjack": "subjack",
    "xsstrike": "xsstrike", "xsser": "xsser",
    "ligolo-ng": "ligolo-ng", "powercat": "powercat",
    "donut": "donut", "fatcat": "fatcat",
    "princeprocessor": "princeprocessor",
    "rubeus": "rubeus", "sipvicious": "sipvicious",
    "cloudbrute": "cloudbrute", "caido": "caido",
    "dnscat2": "dnscat2", "capstone-tool": "capstone-tool",
    "linux-exploit-suggester": "linux-exploit-suggester",
    "pacu": "pacu", "spfquery": "spfquery",
    "spray": "spray", "sprayingtoolkit": "sprayingtoolkit",
    "spraykatz": "spraykatz", "redfang": "redfang",
    "ufw": "ufw", "nftables": "nftables",
    "wpa-sycophant": "wpa-sycophant",
    "zaproxy": "zaproxy", "bandit": "bandit",
    "beef": "beef-xss",
    "wireguard": "wireguard-tools",
    "hashcat-utils": "hashcat-utils",
    "gdb-peda": "gdb-peda", "gef": "gef",
    "bluez": "bluez",
    "csvkit": "csvkit",
    "httpie": "httpie",
}

# ─────────────────────────────────────────
# Go tools: name → go install path
# ─────────────────────────────────────────
GO_TOOLS = {
    "katana": "github.com/projectdiscovery/katana/cmd/katana@latest",
    "dalfox": "github.com/hahwul/dalfox/v2@latest",
    "httpx": "github.com/projectdiscovery/httpx/cmd/httpx@latest",
    "anew": "github.com/tomnomnom/anew@latest",
    "gau": "github.com/lc/gau/v2/cmd/gau@latest",
    "waybackurls": "github.com/tomnomnom/waybackurls@latest",
    "hakrawler": "github.com/hakluke/hakrawler@latest",
    "aquatone": "github.com/michenriksen/aquatone@latest",
    "alterx": "github.com/projectdiscovery/alterx/cmd/alterx@latest",
    "asnmap": "github.com/projectdiscovery/asnmap/cmd/asnmap@latest",
    "interactsh-client": "github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest",
    "notify": "github.com/projectdiscovery/notify/cmd/notify@latest",
    "uncover": "github.com/projectdiscovery/uncover/cmd/uncover@latest",
    "chaos-client": "github.com/projectdiscovery/chaos-client/cmd/chaos-client@latest",
    "tlsx": "github.com/projectdiscovery/tlsx/cmd/tlsx@latest",
}

# ─────────────────────────────────────────
# PIP tools: name → pip package
# ─────────────────────────────────────────
PIP_TOOLS = {
    "lazagne": "lazagne",
    "droopescan": "droopescan",
    "pwntools": "pwntools",
    "angr": "angr",
    "scoutsuite": "scoutsuite",
    "prowler": "prowler",
}

# ─────────────────────────────────────────
# Git clone tools: name → (repo_url, binary_name)
# ─────────────────────────────────────────
GIT_TOOLS = {
    "king-phisher": ("https://github.com/rsmusllp/king-phisher.git", "king-phisher"),
    "blackeye-phish": ("https://github.com/An0nUD4Y/blackeye.git", "blackeye"),
    "social-analyzer": ("https://github.com/qeeqbox/social-analyzer.git", "social-analyzer"),
}

# ─── Binary aliases (tool_name → actual binary to check) ────
BINARY_ALIASES = {
    "metasploit": "msfconsole", "metasploit-framework": "msfconsole",
    "john-the-ripper": "john", "searchsploit": "searchsploit",
    "exploitdb": "searchsploit", "set": "setoolkit",
    "social-engineer-toolkit": "setoolkit",
    "sleuthkit": "blkcat", "awscli": "aws",
    "bluez": "bluetoothctl", "capstone-tool": "cstool",
    "csvkit": "csvcut", "dex2jar": "d2j-apk-sign",
    "hcxtools": "hcxpcapngtool", "ligolo-ng": "ligolo-proxy",
    "miller": "mlr", "nftables": "nft", "redfang": "fang",
    "sipvicious": "svmap", "sliver": "sliver-server",
    "ubertooth": "ubertooth-btle", "wpa-sycophant": "wpa_sycophant",
    "zaproxy": "zaproxy", "gdb-peda": "gdb",
    "hashcat-utils": "cap2hccapx",
    "ettercap": "ettercap", "wireguard": "wg",
    "beef": "beef-xss",
}


def resolve_binary(tool_name: str) -> str:
    """Resolve to actual binary name for checking installation."""
    return BINARY_ALIASES.get(tool_name, tool_name)


def is_installed(tool_name: str) -> bool:
    """Check if a tool binary is available."""
    binary = resolve_binary(tool_name)
    return shutil.which(binary) is not None


def get_missing_tools() -> list[str]:
    """Read missing tools from verification report, or scan registry."""
    report_path = Path(__file__).parent.parent / "verification_report.json"
    if report_path.exists():
        with open(report_path) as f:
            data = json.load(f)
        return data.get("missing", [])
    
    # Fallback: scan all tools from DB
    import sqlite3
    db_path = Path(__file__).parent.parent / "instance" / "cybersec_saas.db"
    conn = sqlite3.connect(str(db_path))
    rows = conn.execute("SELECT name FROM tools WHERE is_active=1").fetchall()
    conn.close()
    return [r[0] for r in rows if not is_installed(r[0])]


def install_apt(packages: list[str], dry_run: bool = False) -> dict[str, bool]:
    """Install packages via apt. Returns {pkg: success}."""
    results = {}
    if not packages:
        return results
    
    print(f"\n{'='*60}")
    print(f"  APT INSTALL — {len(packages)} packages")
    print(f"{'='*60}")
    
    if dry_run:
        for p in packages:
            print(f"  [DRY-RUN] apt-get install -y {p}")
            results[p] = True
        return results
    
    # Update package lists first
    print("  📦 Updating package lists...")
    subprocess.run(
        ["apt-get", "update", "-qq"],
        capture_output=True, timeout=120,
        env={**os.environ, "DEBIAN_FRONTEND": "noninteractive"}
    )
    
    # Install in batches of 20
    batch_size = 20
    for i in range(0, len(packages), batch_size):
        batch = packages[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(packages) + batch_size - 1) // batch_size
        
        print(f"\n  📦 Batch {batch_num}/{total_batches}: {', '.join(batch[:5])}{'...' if len(batch) > 5 else ''}")
        
        try:
            result = subprocess.run(
                ["apt-get", "install", "-y", "--no-install-recommends"] + batch,
                capture_output=True, text=True, timeout=300,
                env={**os.environ, "DEBIAN_FRONTEND": "noninteractive"},
                stdin=subprocess.DEVNULL,
            )
            
            for pkg in batch:
                tool_name = [k for k, v in PACKAGE_MAP.items() if v == pkg]
                check_name = tool_name[0] if tool_name else pkg
                if is_installed(check_name):
                    results[pkg] = True
                    print(f"    ✅ {pkg}")
                else:
                    results[pkg] = False
                    print(f"    ❌ {pkg} (installed but binary not found)")
                    
        except subprocess.TimeoutExpired:
            for pkg in batch:
                results[pkg] = False
            print(f"    ⏰ Batch timed out")
        except Exception as e:
            for pkg in batch:
                results[pkg] = False
            print(f"    ❌ Error: {e}")
    
    return results


def install_go(tools: dict[str, str], dry_run: bool = False) -> dict[str, bool]:
    """Install Go tools. Returns {name: success}."""
    results = {}
    if not tools:
        return results
    
    # Check if Go is available
    go_path = shutil.which("go")
    if not go_path:
        print("\n  ⚠️  Go not installed — skipping Go tools")
        for name in tools:
            results[name] = False
        return results
    
    print(f"\n{'='*60}")
    print(f"  GO INSTALL — {len(tools)} tools")
    print(f"{'='*60}")
    
    go_bin = os.path.expanduser("~/go/bin")
    os.makedirs(go_bin, exist_ok=True)
    
    for name, pkg_path in tools.items():
        if dry_run:
            print(f"  [DRY-RUN] go install {pkg_path}")
            results[name] = True
            continue
        
        print(f"  🔧 Installing {name}...")
        try:
            result = subprocess.run(
                ["go", "install", pkg_path],
                capture_output=True, text=True, timeout=120,
                env={**os.environ, "GOPATH": os.path.expanduser("~/go"),
                     "GOBIN": go_bin, "PATH": os.environ["PATH"] + f":{go_bin}"},
                stdin=subprocess.DEVNULL,
            )
            
            # Check if binary exists
            binary_path = os.path.join(go_bin, name)
            if os.path.isfile(binary_path):
                # Symlink to /usr/local/bin for PATH access
                symlink = f"/usr/local/bin/{name}"
                if not os.path.exists(symlink):
                    try:
                        os.symlink(binary_path, symlink)
                    except Exception:
                        pass
                results[name] = True
                print(f"    ✅ {name}")
            else:
                results[name] = False
                print(f"    ❌ {name} — binary not produced")
                if result.stderr:
                    print(f"       {result.stderr[:200]}")
        except subprocess.TimeoutExpired:
            results[name] = False
            print(f"    ⏰ {name} — timed out")
        except Exception as e:
            results[name] = False
            print(f"    ❌ {name} — {e}")
    
    return results


def install_pip(tools: dict[str, str], dry_run: bool = False) -> dict[str, bool]:
    """Install Python tools via pip. Returns {name: success}."""
    results = {}
    if not tools:
        return results
    
    print(f"\n{'='*60}")
    print(f"  PIP INSTALL — {len(tools)} tools")
    print(f"{'='*60}")
    
    for name, pkg in tools.items():
        if dry_run:
            print(f"  [DRY-RUN] pip3 install {pkg}")
            results[name] = True
            continue
        
        print(f"  🐍 Installing {name}...")
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "--break-system-packages", pkg],
                capture_output=True, text=True, timeout=120,
                stdin=subprocess.DEVNULL,
            )
            if result.returncode == 0:
                results[name] = True
                print(f"    ✅ {name}")
            else:
                results[name] = False
                print(f"    ❌ {name}")
        except Exception as e:
            results[name] = False
            print(f"    ❌ {name} — {e}")
    
    return results


def install_git(tools: dict[str, tuple[str, str]], dry_run: bool = False) -> dict[str, bool]:
    """Clone git repos for tools. Returns {name: success}."""
    results = {}
    if not tools:
        return results
    
    print(f"\n{'='*60}")
    print(f"  GIT CLONE — {len(tools)} repos")
    print(f"{'='*60}")
    
    opt_base = Path("/opt/tools")
    opt_base.mkdir(parents=True, exist_ok=True)
    
    for name, (repo_url, binary) in tools.items():
        dest = opt_base / name
        if dry_run:
            print(f"  [DRY-RUN] git clone {repo_url} {dest}")
            results[name] = True
            continue
        
        print(f"  📂 Cloning {name}...")
        if dest.exists():
            print(f"    ℹ️  Already cloned at {dest}")
            results[name] = True
            continue
        
        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", repo_url, str(dest)],
                capture_output=True, text=True, timeout=60,
                stdin=subprocess.DEVNULL,
            )
            results[name] = dest.exists()
            if results[name]:
                print(f"    ✅ {name} → {dest}")
            else:
                print(f"    ❌ {name} — clone failed")
        except Exception as e:
            results[name] = False
            print(f"    ❌ {name} — {e}")
    
    return results


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Install missing CyberSec Pro tools")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    parser.add_argument("--verify", action="store_true", help="Run verification after install")
    parser.add_argument("--apt-only", action="store_true", help="Only install APT packages")
    parser.add_argument("--go-only", action="store_true", help="Only install Go tools")
    args = parser.parse_args()
    
    print("""
╔══════════════════════════════════════════════════════════╗
║      CYBERSEC-PRO V10 — MISSING TOOLS INSTALLER          ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    # 1. Get missing tools
    missing = get_missing_tools()
    print(f"  Total missing tools: {len(missing)}")
    
    if not missing:
        print("  ✅ All tools installed! Nothing to do.")
        return
    
    # 2. Classify each tool by installation strategy
    apt_install = {}   # tool → package
    go_install = {}    # tool → go path
    pip_install = {}   # tool → pip package
    git_install = {}   # tool → (repo_url, binary)
    unknown = []
    
    for tool in missing:
        if not args.go_only and tool in PACKAGE_MAP:
            apt_install[tool] = PACKAGE_MAP[tool]
        elif not args.apt_only and tool in GO_TOOLS:
            go_install[tool] = GO_TOOLS[tool]
        elif not args.apt_only and tool in PIP_TOOLS:
            pip_install[tool] = PIP_TOOLS[tool]
        elif not args.apt_only and tool in GIT_TOOLS:
            git_install[tool] = GIT_TOOLS[tool]
        else:
            # Try apt-cache search as last resort
            if not args.go_only:
                try:
                    r = subprocess.run(
                        ["apt-cache", "search", f"^{tool}$"],
                        capture_output=True, text=True, timeout=5,
                        stdin=subprocess.DEVNULL,
                    )
                    if r.stdout.strip():
                        apt_install[tool] = tool
                        continue
                except Exception:
                    pass
            unknown.append(tool)
    
    print(f"\n  📊 Installation Strategy:")
    print(f"    APT packages: {len(apt_install)}")
    print(f"    Go tools:     {len(go_install)}")
    print(f"    PIP packages: {len(pip_install)}")
    print(f"    Git clones:   {len(git_install)}")
    print(f"    Unknown:      {len(unknown)}")
    
    # 3. Execute installations
    total_success = 0
    total_fail = 0
    
    if apt_install and not args.go_only:
        apt_pkgs = list(set(apt_install.values()))
        results = install_apt(apt_pkgs, dry_run=args.dry_run)
        total_success += sum(1 for v in results.values() if v)
        total_fail += sum(1 for v in results.values() if not v)
    
    if go_install and not args.apt_only:
        results = install_go(go_install, dry_run=args.dry_run)
        total_success += sum(1 for v in results.values() if v)
        total_fail += sum(1 for v in results.values() if not v)
    
    if pip_install and not args.apt_only and not args.go_only:
        results = install_pip(pip_install, dry_run=args.dry_run)
        total_success += sum(1 for v in results.values() if v)
        total_fail += sum(1 for v in results.values() if not v)
    
    if git_install and not args.apt_only and not args.go_only:
        results = install_git(git_install, dry_run=args.dry_run)
        total_success += sum(1 for v in results.values() if v)
        total_fail += sum(1 for v in results.values() if not v)
    
    # 4. Summary
    print(f"\n{'='*60}")
    print(f"  INSTALLATION SUMMARY")
    print(f"{'='*60}")
    print(f"  ✅ Installed: {total_success}")
    print(f"  ❌ Failed:    {total_fail}")
    print(f"  ❓ Unknown:   {len(unknown)}")
    
    if unknown and len(unknown) <= 30:
        print(f"\n  Unknown tools (no install strategy):")
        for t in sorted(unknown)[:30]:
            print(f"    • {t}")
    
    # 5. Auto-verify
    if args.verify and not args.dry_run:
        print(f"\n  🔄 Running verification suite...")
        verify_script = Path(__file__).parent / "verify_ultimate.py"
        if verify_script.exists():
            subprocess.run(
                [sys.executable, str(verify_script), "--workers", "6", "--timeout", "8"],
                cwd=str(Path(__file__).parent.parent),
            )
        else:
            print(f"  ⚠️  verify_ultimate.py not found")


if __name__ == "__main__":
    main()
