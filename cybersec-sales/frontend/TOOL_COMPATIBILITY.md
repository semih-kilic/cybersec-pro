# CyberSec Pro - Tool Compatibility Guide

## Overview
CyberSec Pro integrates 778 security tools through a unified dashboard interface.

### Tool Status on Different Systems

| System | Tools Available | Notes |
|--------|-----------------|-------|
| **Kali Linux** | 230 (100%) | All tools pre-installed |
| **Ubuntu/Debian** | ~140 (60%) | Some tools need manual install |
| **Docker (Kali)** | 230 (100%) | Full compatibility |
| **Windows WSL2** | ~100 (43%) | Limited tool support |

## Pre-Installed Tools (Work Everywhere)

### Network Scanning (100% compatible)
- Nmap - Network scanner ✅
- Masscan - Fast port scanner ✅
- Netdiscover - Network discovery ✅
- Arp-scan - ARP scanner ✅

### Web Application Testing (90% compatible)
- Nikto - Web scanner ✅
- SQLMap - SQL injection ✅
- WPScan - WordPress scanner ✅
- Gobuster - Directory brute-force ✅
- Dirb - Directory scanner ✅
- OWASP ZAP - Web proxy ✅

### Password Attacks (85% compatible)
- John the Ripper ✅
- Hashcat ✅
- Hydra ✅
- Medusa ✅
- Crunch ✅

### Sniffing & Spoofing (80% compatible)
- Wireshark ✅
- Tcpdump ✅
- Ettercap ✅
- Responder ✅

## Tools Requiring Kali Linux or Docker

### GUI Tools (Kali only)
- Burp Suite CE
- Armitage
- Maltego
- OWASP ZAP (GUI)

### Wireless Tools (Hardware dependent)
- Aircrack-ng suite
- Kismet
- Fern Wifi Cracker
- Reaver

### Advanced Exploitation
- Metasploit Framework (works but heavy)
- BeEF
- Veil
- Empire

## Recommended Setup

### For Best Experience
1. **Use Kali Linux** - All 778 tools work out of the box
2. **Use Docker** - Full Kali environment in a container

### Docker Quick Start
```bash
# Pull Kali Linux image with tools
docker pull kalilinux/kali-rolling

# Run CyberSec Pro with Kali tools
docker-compose up -d
```

### For Ubuntu/Debian Users
Many tools can be installed from repositories:
```bash
sudo apt install nmap nikto sqlmap hydra john gobuster dirb metasploit-framework
```

## Support

If you encounter tool compatibility issues:
1. Check if tool is installed: `which toolname`
2. Install via apt: `sudo apt install toolname`
3. Use Docker for full compatibility
4. Contact support: cybersecpro@semihkilic.com
