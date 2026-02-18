#!/usr/bin/env python3
"""
CyberSec Pro - Dangerous Tool Handling & Security Isolation
Part of Master Prompt Part 2 (BÖLÜM 5 & 8)

Handles:
- Active exploitation tools (sandbox mode)
- GUI tools (headless alternatives)
- Hardware-dependent tools (not applicable messages)
- Security isolation measures
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# DANGEROUS TOOL STRATEGY
# PRİNCİPLE: Remove warnings. Tools run controlled in backend.
# User NEVER sees technical tool names.
# ═══════════════════════════════════════════════════════════════

DANGEROUS_TOOL_STRATEGY = {
    # Active Exploitation Tools
    "metasploit": {
        "category": "active_exploitation",
        "backend_mode": "sandbox_verify_only",
        "description": "Only tests if vulnerability is exploitable, no actual exploitation",
        "user_display": "Advanced Vulnerability Verification",
        "user_explanation": "Verifies whether detected vulnerabilities can actually be exploited by attackers",
        "max_runtime": 120,
        "sandbox": True,
        "safe_args": ["--no-payload", "--check-only"],
    },
    "beef-xss": {
        "category": "active_exploitation",
        "backend_mode": "sandbox_verify_only",
        "description": "Tests browser exploitation vectors in sandbox",
        "user_display": "Browser Security Verification",
        "user_explanation": "Tests if your users' browsers are protected against common attack vectors",
        "max_runtime": 60,
        "sandbox": True,
    },
    "msfconsole": {
        "category": "active_exploitation",
        "backend_mode": "sandbox_verify_only",
        "description": "Advanced exploit verification only",
        "user_display": "Advanced Penetration Verification",
        "user_explanation": "Advanced verification of vulnerability exploitability",
        "max_runtime": 120,
        "sandbox": True,
    },
    "msfvenom": {
        "category": "active_exploitation",
        "backend_mode": "sandbox_verify_only",
        "description": "Generates test payloads in sandbox",
        "user_display": "Payload Detection Testing",
        "user_explanation": "Tests if your security systems can detect common attack payloads",
        "max_runtime": 30,
        "sandbox": True,
    },

    # Password Cracking Tools
    "john": {
        "category": "password_cracking",
        "backend_mode": "weak_hash_detection_only",
        "description": "Only detects weak hash algorithms, does NOT crack passwords",
        "user_display": "Password Strength Analysis",
        "user_explanation": "Tests your password policy and hash algorithm strength",
        "max_runtime": 60,
        "safe_args": ["--test", "--format=detect"],
    },
    "hashcat": {
        "category": "password_cracking",
        "backend_mode": "weak_hash_detection_only",
        "description": "Detects weak hash algorithms using GPU analysis",
        "user_display": "Advanced Password Strength Analyzer",
        "user_explanation": "GPU-accelerated analysis of password storage security",
        "max_runtime": 60,
        "safe_args": ["--benchmark", "--identify"],
    },

    # Brute Force Tools
    "hydra": {
        "category": "brute_force",
        "backend_mode": "rate_limited",
        "description": "Rate-limited, max 10 attempts, tests lockout policy",
        "user_display": "Login Protection Testing",
        "user_explanation": "Tests brute force protection and account lockout mechanisms",
        "max_runtime": 30,
        "max_attempts": 10,
        "rate_limit": "1/second",
    },
    "medusa": {
        "category": "brute_force",
        "backend_mode": "rate_limited",
        "description": "Limited credential testing for lockout verification",
        "user_display": "Authentication Security Tester",
        "user_explanation": "Tests if your login systems properly lock out repeated failed attempts",
        "max_runtime": 30,
        "max_attempts": 10,
        "rate_limit": "1/second",
    },
    "ncrack": {
        "category": "brute_force",
        "backend_mode": "rate_limited",
        "description": "Network auth testing with limits",
        "user_display": "Network Login Security Checker",
        "user_explanation": "Tests network service login security with controlled attempts",
        "max_runtime": 30,
        "max_attempts": 10,
    },

    # DDoS Tools - NEVER USE, only test rate limits
    "slowloris": {
        "category": "ddos",
        "backend_mode": "rate_limit_test_only",
        "description": "NEVER sends DDoS, only tests rate limiting",
        "user_display": "Traffic Handling Test",
        "user_explanation": "Tests how your server handles unusual traffic patterns",
        "max_runtime": 30,
        "safe_mode": True,
    },
    "hping3": {
        "category": "ddos",
        "backend_mode": "rate_limit_test_only",
        "description": "Protocol testing only, no flood",
        "user_display": "Network Protocol Resilience Test",
        "user_explanation": "Tests your network's resilience to protocol-level anomalies",
        "max_runtime": 30,
        "safe_mode": True,
        "safe_args": ["-c", "5"],  # Max 5 packets
    },

    # Social Engineering
    "setoolkit": {
        "category": "social_engineering",
        "backend_mode": "simulation_only",
        "description": "Simulates phishing for awareness testing",
        "user_display": "Phishing Awareness Simulation",
        "user_explanation": "Tests employee awareness against simulated phishing attacks",
        "max_runtime": 60,
    },
    "gophish": {
        "category": "social_engineering",
        "backend_mode": "simulation_only",
        "description": "Email security awareness campaigns",
        "user_display": "Email Security Awareness Campaign",
        "user_explanation": "Runs controlled phishing simulations to train employees",
        "max_runtime": 60,
    },
}


# ═══════════════════════════════════════════════════════════════
# GUI TOOLS → HEADLESS ALTERNATIVES
# ═══════════════════════════════════════════════════════════════

HEADLESS_ALTERNATIVES = {
    "burpsuite": {
        "headless_command": "java -jar burpsuite_community.jar --project-file=/tmp/project.burp --config-file=headless.json",
        "api_mode": True,
        "api_port": 8080,
        "alternative_tool": "zaproxy",
        "user_display": "Web Application Security Platform",
    },
    "zaproxy": {
        "headless_command": "zap.sh -daemon -port 8090 -config api.key={{API_KEY}}",
        "api_mode": True,
        "api_port": 8090,
        "user_display": "Automated Security Scanner",
    },
    "wireshark": {
        "alternative": "tshark",
        "headless_command": "tshark -i any -a duration:60 -w /tmp/capture.pcap",
        "user_display": "Network Traffic Analyzer",
    },
    "maltego": {
        "alternative": "recon-ng",
        "headless_command": "recon-ng -w workspace --no-check",
        "user_display": "Intelligence Gathering Platform",
    },
    "autopsy": {
        "alternative": "sleuthkit",
        "headless_command": "fls -r -m / image.dd",
        "user_display": "Digital Forensics Analyzer",
        "note": "Not applicable for standard web security scans",
    },
    "armitage": {
        "alternative": "msfconsole",
        "headless_command": "msfconsole -q -x 'resource script.rc'",
        "user_display": "Penetration Testing Console",
    },
}


# ═══════════════════════════════════════════════════════════════
# HARDWARE-DEPENDENT TOOLS
# These require physical proximity - shown as "not applicable"
# ═══════════════════════════════════════════════════════════════

HARDWARE_DEPENDENT_TOOLS = {
    "wireless": {
        "tools": ["aircrack-ng", "wifite", "reaver", "pixiewps", "bully",
                  "fern-wifi-cracker", "kismet", "airgeddon", "fluxion"],
        "dashboard_text": "Wireless Security Testing",
        "status": "not_applicable",
        "status_label": "Not applicable for remote scans",
        "explanation": "Wireless security testing requires physical proximity to your network.",
        "enterprise_option": "Available as on-site audit for Enterprise customers.",
        "icon": "wifi",
        "cta": "Contact Sales for on-site wireless security assessment",
        "cta_link": "mailto:sales@semihkilic.com?subject=On-site%20Wireless%20Audit",
    },
    "bluetooth": {
        "tools": ["bluemaho", "bluesnarfer", "btscanner", "spooftooph",
                  "blueranger", "ubertooth"],
        "dashboard_text": "Bluetooth Security Testing",
        "status": "not_applicable",
        "status_label": "Not applicable for remote scans",
        "explanation": "Bluetooth testing requires physical devices and proximity.",
        "enterprise_option": "Available as on-site assessment.",
        "icon": "bluetooth",
        "cta": "Contact Sales",
        "cta_link": "mailto:sales@semihkilic.com?subject=On-site%20Bluetooth%20Audit",
    },
    "hardware": {
        "tools": ["bus-pirate", "rubber-ducky", "lan-turtle", "usb-armory",
                  "proxmark3", "chameleon-mini"],
        "dashboard_text": "Hardware Security Testing",
        "status": "out_of_scope",
        "status_label": "Out of scope for cloud platform",
        "explanation": "Hardware security testing requires specialized physical equipment.",
        "enterprise_option": "Contact us for custom hardware security audits.",
        "icon": "cpu-chip",
        "cta": "Contact Sales",
        "cta_link": "mailto:sales@semihkilic.com?subject=Hardware%20Security",
    },
    "rfid_nfc": {
        "tools": ["libnfc", "mfoc", "mfcuk", "nfc-mfclassic"],
        "dashboard_text": "RFID/NFC Security Testing",
        "status": "out_of_scope",
        "status_label": "Out of scope for cloud platform",
        "explanation": "RFID/NFC testing requires physical readers and proximity.",
        "enterprise_option": "Contact us for physical security assessment.",
        "icon": "signal",
        "cta": "Contact Sales",
        "cta_link": "mailto:sales@semihkilic.com?subject=RFID%20NFC%20Security",
    },
}


# ═══════════════════════════════════════════════════════════════
# SECURITY & ISOLATION MEASURES (BÖLÜM 8)
# ═══════════════════════════════════════════════════════════════

SECURITY_MEASURES = {
    "container_isolation": {
        "read_only_filesystem": True,
        "no_new_privileges": True,
        "cap_drop": ["ALL"],
        "memory_limit": "512MB",
        "cpu_limit": "50%",
        "network": "target_only",
        "auto_remove": True,
        "max_runtime": "10min per tool",
    },
    "ownership_verification": {
        "methods": [
            {
                "id": "dns_txt",
                "name": "DNS TXT Record",
                "instruction": "Add a TXT record to your domain: cybersecpro-verify=TOKEN",
                "auto_check": True,
            },
            {
                "id": "meta_tag",
                "name": "HTML Meta Tag",
                "instruction": "Add to your homepage: <meta name=\'cybersecpro-verify\' content=\'TOKEN\'>",
                "auto_check": True,
            },
            {
                "id": "html_file",
                "name": "HTML File Upload",
                "instruction": "Upload cybersecpro-verify.html to your web root",
                "auto_check": True,
            },
            {
                "id": "http_header",
                "name": "HTTP Header",
                "instruction": "Add response header: X-CyberSecPro-Verify: TOKEN",
                "auto_check": True,
            },
        ],
        "required_before": "any scan can start",
        "re_verify_interval_days": 30,
    },
    "rate_limiting": {
        "max_requests_per_second": 10,
        "max_concurrent_tools": 5,
        "backoff_on_error": True,
        "respect_robots_txt": True,
    },
    "data_security": {
        "encryption_in_transit": "TLS 1.3",
        "encryption_at_rest": "AES-256",
        "data_retention": "plan_based",
        "no_customer_data_stored": True,
        "gdpr_compliant": True,
        "servers": "EU only (AWS eu-north-1, Finland)",
    },
}


# ═══════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════

def is_dangerous_tool(tool_name: str) -> bool:
    """Check if a tool requires special handling."""
    return tool_name.lower() in DANGEROUS_TOOL_STRATEGY


def get_safe_execution_config(tool_name: str) -> Optional[Dict[str, Any]]:
    """Get safe execution configuration for a dangerous tool."""
    key = tool_name.lower()
    if key in DANGEROUS_TOOL_STRATEGY:
        config = DANGEROUS_TOOL_STRATEGY[key].copy()
        config["tool_name"] = key
        return config
    return None


def get_headless_config(tool_name: str) -> Optional[Dict[str, Any]]:
    """Get headless alternative for a GUI tool."""
    key = tool_name.lower()
    if key in HEADLESS_ALTERNATIVES:
        return HEADLESS_ALTERNATIVES[key].copy()
    return None


def is_hardware_dependent(tool_name: str) -> Optional[Dict[str, Any]]:
    """Check if a tool requires hardware. Returns category info or None."""
    key = tool_name.lower()
    for category, info in HARDWARE_DEPENDENT_TOOLS.items():
        if key in info["tools"]:
            return {
                "category": category,
                "dashboard_text": info["dashboard_text"],
                "status": info["status"],
                "status_label": info["status_label"],
                "explanation": info["explanation"],
                "enterprise_option": info["enterprise_option"],
                "icon": info["icon"],
                "cta": info["cta"],
                "cta_link": info["cta_link"],
            }
    return None


def get_tool_execution_mode(tool_name: str) -> Dict[str, Any]:
    """Determine how a tool should be executed.
    
    Returns a dict with:
        mode: 'standard' | 'sandbox' | 'headless' | 'not_applicable' | 'out_of_scope'
        config: relevant configuration dict
        user_display: what to show the user
    """
    key = tool_name.lower()

    # Check hardware dependency first
    hw = is_hardware_dependent(key)
    if hw:
        return {
            "mode": hw["status"],
            "config": hw,
            "user_display": hw["dashboard_text"],
            "user_explanation": hw["explanation"],
            "can_execute": False,
        }

    # Check dangerous tool
    if is_dangerous_tool(key):
        config = get_safe_execution_config(key)
        return {
            "mode": "sandbox",
            "config": config,
            "user_display": config["user_display"],
            "user_explanation": config["user_explanation"],
            "can_execute": True,
            "sandbox": config.get("sandbox", False),
            "max_runtime": config.get("max_runtime", 60),
        }

    # Check GUI tool
    headless = get_headless_config(key)
    if headless:
        return {
            "mode": "headless",
            "config": headless,
            "user_display": headless["user_display"],
            "user_explanation": f"Running in automated mode",
            "can_execute": True,
        }

    # Standard execution
    return {
        "mode": "standard",
        "config": {},
        "user_display": tool_name,
        "user_explanation": "Standard security test execution",
        "can_execute": True,
    }


def get_all_hardware_tools() -> list:
    """Get flat list of all hardware-dependent tool names."""
    tools = []
    for cat_info in HARDWARE_DEPENDENT_TOOLS.values():
        tools.extend(cat_info["tools"])
    return tools


def get_verification_methods() -> list:
    """Get ownership verification methods for the UI."""
    return SECURITY_MEASURES["ownership_verification"]["methods"]
