#!/usr/bin/env python3
"""
🛡️ Comprehensive Kali Linux Tools Database
World-class documentation like kali.org/tools/

Every tool includes:
- Full description & synopsis
- All parameters with detailed explanations
- Usage examples
- Common presets
- Related tools
"""

KALI_TOOLS_COMPLETE = {
    # ========================================
    # NMAP - Network Mapper
    # ========================================
    "nmap": {
        "name": "Nmap",
        "slug": "nmap",
        "category": "Information Gathering",
        "subcategory": "Port Scanning",
        "description": "Network exploration tool and security / port scanner",
        "long_description": """Nmap ("Network Mapper") is a free and open source utility for network discovery and security auditing. Many systems and network administrators also find it useful for tasks such as network inventory, managing service upgrade schedules, and monitoring host or service uptime.

Nmap uses raw IP packets in novel ways to determine what hosts are available on the network, what services (application name and version) those hosts are offering, what operating systems (and OS versions) they are running, what type of packet filters/firewalls are in use, and dozens of other characteristics.

It was designed to rapidly scan large networks, but works fine against single hosts. Nmap runs on all major computer operating systems, and official binary packages are available for Linux, Windows, and Mac OS X.""",
        "author": "Gordon Lyon (Fyodor)",
        "version": "7.94",
        "license": "GPL-2.0",
        "homepage": "https://nmap.org",
        "repository": "https://github.com/nmap/nmap",
        "documentation_url": "https://nmap.org/book/man.html",
        "plan_required": "starter",
        "installation": "apt install nmap",
        "docker_image": "instrumentisto/nmap",
        "command_template": "nmap {options} {target}",
        "tags": ["network", "scanner", "port", "discovery", "security", "audit"],
        "parameters": [
            # TARGET SPECIFICATION
            {
                "name": "target",
                "short_flag": None,
                "long_flag": None,
                "description": "Target specification - can be hostnames, IP addresses, networks, etc.",
                "value_type": "string",
                "required": True,
                "default_value": None,
                "example_value": "192.168.1.0/24",
                "category": "target",
                "order": 1
            },
            {
                "name": "input_file",
                "short_flag": "-iL",
                "long_flag": None,
                "description": "Input from list of hosts/networks from file",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "targets.txt",
                "category": "target",
                "order": 2
            },
            {
                "name": "random_targets",
                "short_flag": "-iR",
                "long_flag": None,
                "description": "Choose random targets. 0 means never-ending scan",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "100",
                "category": "target",
                "order": 3
            },
            {
                "name": "exclude",
                "short_flag": None,
                "long_flag": "--exclude",
                "description": "Exclude hosts/networks from scan",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "192.168.1.1,192.168.1.254",
                "category": "target",
                "order": 4
            },
            {
                "name": "exclude_file",
                "short_flag": None,
                "long_flag": "--excludefile",
                "description": "Exclude list from file",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "exclude.txt",
                "category": "target",
                "order": 5
            },
            
            # HOST DISCOVERY
            {
                "name": "list_scan",
                "short_flag": "-sL",
                "long_flag": None,
                "description": "List Scan - simply list targets to scan (no actual scan)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "host_discovery",
                "order": 10
            },
            {
                "name": "ping_scan",
                "short_flag": "-sn",
                "long_flag": None,
                "description": "Ping Scan - disable port scan, only host discovery",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "host_discovery",
                "order": 11
            },
            {
                "name": "skip_discovery",
                "short_flag": "-Pn",
                "long_flag": None,
                "description": "Treat all hosts as online - skip host discovery",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "host_discovery",
                "order": 12
            },
            {
                "name": "tcp_syn_discovery",
                "short_flag": "-PS",
                "long_flag": None,
                "description": "TCP SYN discovery to given ports (default 80)",
                "value_type": "string",
                "required": False,
                "default_value": "80",
                "example_value": "22,80,443",
                "category": "host_discovery",
                "order": 13
            },
            {
                "name": "tcp_ack_discovery",
                "short_flag": "-PA",
                "long_flag": None,
                "description": "TCP ACK discovery to given ports",
                "value_type": "string",
                "required": False,
                "default_value": "80",
                "example_value": "80,443",
                "category": "host_discovery",
                "order": 14
            },
            {
                "name": "udp_discovery",
                "short_flag": "-PU",
                "long_flag": None,
                "description": "UDP discovery to given ports",
                "value_type": "string",
                "required": False,
                "default_value": "40125",
                "example_value": "53,161",
                "category": "host_discovery",
                "order": 15
            },
            {
                "name": "sctp_discovery",
                "short_flag": "-PY",
                "long_flag": None,
                "description": "SCTP discovery to given ports",
                "value_type": "string",
                "required": False,
                "default_value": "80",
                "example_value": "80",
                "category": "host_discovery",
                "order": 16
            },
            {
                "name": "icmp_echo",
                "short_flag": "-PE",
                "long_flag": None,
                "description": "ICMP echo request discovery probes",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "host_discovery",
                "order": 17
            },
            {
                "name": "icmp_timestamp",
                "short_flag": "-PP",
                "long_flag": None,
                "description": "ICMP timestamp request discovery probes",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "host_discovery",
                "order": 18
            },
            {
                "name": "icmp_netmask",
                "short_flag": "-PM",
                "long_flag": None,
                "description": "ICMP netmask request discovery probes",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "host_discovery",
                "order": 19
            },
            {
                "name": "ip_protocol_ping",
                "short_flag": "-PO",
                "long_flag": None,
                "description": "IP Protocol Ping with specified protocols",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "1,2,4",
                "category": "host_discovery",
                "order": 20
            },
            {
                "name": "no_dns",
                "short_flag": "-n",
                "long_flag": None,
                "description": "Never do DNS resolution",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "host_discovery",
                "order": 21
            },
            {
                "name": "dns_resolution",
                "short_flag": "-R",
                "long_flag": None,
                "description": "Always resolve DNS (default: sometimes)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "host_discovery",
                "order": 22
            },
            {
                "name": "dns_servers",
                "short_flag": None,
                "long_flag": "--dns-servers",
                "description": "Specify custom DNS servers",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "8.8.8.8,8.8.4.4",
                "category": "host_discovery",
                "order": 23
            },
            {
                "name": "system_dns",
                "short_flag": None,
                "long_flag": "--system-dns",
                "description": "Use OS's DNS resolver",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "host_discovery",
                "order": 24
            },
            {
                "name": "traceroute",
                "short_flag": None,
                "long_flag": "--traceroute",
                "description": "Trace hop path to each host",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "host_discovery",
                "order": 25
            },
            
            # SCAN TECHNIQUES
            {
                "name": "syn_scan",
                "short_flag": "-sS",
                "long_flag": None,
                "description": "TCP SYN scan (stealth, default with root)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_techniques",
                "order": 30
            },
            {
                "name": "connect_scan",
                "short_flag": "-sT",
                "long_flag": None,
                "description": "TCP connect scan (default without root)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_techniques",
                "order": 31
            },
            {
                "name": "ack_scan",
                "short_flag": "-sA",
                "long_flag": None,
                "description": "TCP ACK scan (map firewall rules)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_techniques",
                "order": 32
            },
            {
                "name": "window_scan",
                "short_flag": "-sW",
                "long_flag": None,
                "description": "TCP Window scan",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_techniques",
                "order": 33
            },
            {
                "name": "maimon_scan",
                "short_flag": "-sM",
                "long_flag": None,
                "description": "TCP Maimon scan",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_techniques",
                "order": 34
            },
            {
                "name": "udp_scan",
                "short_flag": "-sU",
                "long_flag": None,
                "description": "UDP Scan",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_techniques",
                "order": 35
            },
            {
                "name": "tcp_null_scan",
                "short_flag": "-sN",
                "long_flag": None,
                "description": "TCP Null scan (no flags set)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_techniques",
                "order": 36
            },
            {
                "name": "fin_scan",
                "short_flag": "-sF",
                "long_flag": None,
                "description": "FIN scan (only FIN flag set)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_techniques",
                "order": 37
            },
            {
                "name": "xmas_scan",
                "short_flag": "-sX",
                "long_flag": None,
                "description": "Xmas scan (FIN, PSH, URG flags)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_techniques",
                "order": 38
            },
            {
                "name": "scanflags",
                "short_flag": None,
                "long_flag": "--scanflags",
                "description": "Customize TCP scan flags",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "URGACKPSHRSTSYNFIN",
                "category": "scan_techniques",
                "order": 39
            },
            {
                "name": "idle_scan",
                "short_flag": "-sI",
                "long_flag": None,
                "description": "Idle scan using zombie host",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "zombie_host:probeport",
                "category": "scan_techniques",
                "order": 40
            },
            {
                "name": "sctp_init",
                "short_flag": "-sY",
                "long_flag": None,
                "description": "SCTP INIT scan",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_techniques",
                "order": 41
            },
            {
                "name": "sctp_cookie_echo",
                "short_flag": "-sZ",
                "long_flag": None,
                "description": "SCTP COOKIE-ECHO scan",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_techniques",
                "order": 42
            },
            {
                "name": "ip_protocol_scan",
                "short_flag": "-sO",
                "long_flag": None,
                "description": "IP protocol scan",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_techniques",
                "order": 43
            },
            {
                "name": "ftp_bounce",
                "short_flag": "-b",
                "long_flag": None,
                "description": "FTP bounce scan using relay host",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "ftp_relay_host",
                "category": "scan_techniques",
                "order": 44
            },
            
            # PORT SPECIFICATION
            {
                "name": "ports",
                "short_flag": "-p",
                "long_flag": None,
                "description": "Specify ports to scan (e.g., -p22; -p1-65535; -p U:53,T:21-25,80)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "1-1000",
                "category": "port_specification",
                "order": 50
            },
            {
                "name": "exclude_ports",
                "short_flag": None,
                "long_flag": "--exclude-ports",
                "description": "Exclude specified ports from scanning",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "135,139,445",
                "category": "port_specification",
                "order": 51
            },
            {
                "name": "fast_scan",
                "short_flag": "-F",
                "long_flag": None,
                "description": "Fast mode - Scan fewer ports than default (top 100)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "port_specification",
                "order": 52
            },
            {
                "name": "consecutive_ports",
                "short_flag": "-r",
                "long_flag": None,
                "description": "Scan ports consecutively - don't randomize",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "port_specification",
                "order": 53
            },
            {
                "name": "top_ports",
                "short_flag": None,
                "long_flag": "--top-ports",
                "description": "Scan <number> most common ports",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "1000",
                "category": "port_specification",
                "order": 54
            },
            {
                "name": "port_ratio",
                "short_flag": None,
                "long_flag": "--port-ratio",
                "description": "Scan ports more common than <ratio>",
                "value_type": "float",
                "required": False,
                "default_value": None,
                "example_value": "0.1",
                "category": "port_specification",
                "order": 55
            },
            
            # SERVICE/VERSION DETECTION
            {
                "name": "service_version",
                "short_flag": "-sV",
                "long_flag": None,
                "description": "Probe open ports to determine service/version info",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "service_detection",
                "order": 60
            },
            {
                "name": "version_intensity",
                "short_flag": None,
                "long_flag": "--version-intensity",
                "description": "Set from 0 (light) to 9 (try all probes)",
                "value_type": "integer",
                "required": False,
                "default_value": 7,
                "example_value": "9",
                "category": "service_detection",
                "order": 61
            },
            {
                "name": "version_light",
                "short_flag": None,
                "long_flag": "--version-light",
                "description": "Limit to most likely probes (intensity 2)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "service_detection",
                "order": 62
            },
            {
                "name": "version_all",
                "short_flag": None,
                "long_flag": "--version-all",
                "description": "Try every single probe (intensity 9)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "service_detection",
                "order": 63
            },
            {
                "name": "version_trace",
                "short_flag": None,
                "long_flag": "--version-trace",
                "description": "Show detailed version scan activity (for debugging)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "service_detection",
                "order": 64
            },
            
            # SCRIPT SCAN
            {
                "name": "script_scan",
                "short_flag": "-sC",
                "long_flag": None,
                "description": "Equivalent to --script=default",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "script_scan",
                "order": 70
            },
            {
                "name": "script",
                "short_flag": None,
                "long_flag": "--script",
                "description": "Run scripts (categories, names, or expressions)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "vuln,exploit",
                "category": "script_scan",
                "order": 71
            },
            {
                "name": "script_args",
                "short_flag": None,
                "long_flag": "--script-args",
                "description": "Provide arguments to scripts",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "user=admin,pass=password",
                "category": "script_scan",
                "order": 72
            },
            {
                "name": "script_args_file",
                "short_flag": None,
                "long_flag": "--script-args-file",
                "description": "Provide NSE script args in a file",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "script-args.txt",
                "category": "script_scan",
                "order": 73
            },
            {
                "name": "script_trace",
                "short_flag": None,
                "long_flag": "--script-trace",
                "description": "Show all data sent and received",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "script_scan",
                "order": 74
            },
            {
                "name": "script_updatedb",
                "short_flag": None,
                "long_flag": "--script-updatedb",
                "description": "Update the script database",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "script_scan",
                "order": 75
            },
            {
                "name": "script_help",
                "short_flag": None,
                "long_flag": "--script-help",
                "description": "Show help about scripts",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "http-*",
                "category": "script_scan",
                "order": 76
            },
            
            # OS DETECTION
            {
                "name": "os_detection",
                "short_flag": "-O",
                "long_flag": None,
                "description": "Enable OS detection",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "os_detection",
                "order": 80
            },
            {
                "name": "osscan_limit",
                "short_flag": None,
                "long_flag": "--osscan-limit",
                "description": "Limit OS detection to promising targets",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "os_detection",
                "order": 81
            },
            {
                "name": "osscan_guess",
                "short_flag": None,
                "long_flag": "--osscan-guess",
                "description": "Guess OS more aggressively",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "os_detection",
                "order": 82
            },
            
            # TIMING AND PERFORMANCE
            {
                "name": "timing",
                "short_flag": "-T",
                "long_flag": None,
                "description": "Timing template (0-5, higher is faster)",
                "value_type": "integer",
                "required": False,
                "default_value": 3,
                "example_value": "4",
                "category": "timing",
                "order": 90
            },
            {
                "name": "min_hostgroup",
                "short_flag": None,
                "long_flag": "--min-hostgroup",
                "description": "Minimum parallel host scan group size",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "256",
                "category": "timing",
                "order": 91
            },
            {
                "name": "max_hostgroup",
                "short_flag": None,
                "long_flag": "--max-hostgroup",
                "description": "Maximum parallel host scan group size",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "1024",
                "category": "timing",
                "order": 92
            },
            {
                "name": "min_parallelism",
                "short_flag": None,
                "long_flag": "--min-parallelism",
                "description": "Minimum probe parallelization",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "100",
                "category": "timing",
                "order": 93
            },
            {
                "name": "max_parallelism",
                "short_flag": None,
                "long_flag": "--max-parallelism",
                "description": "Maximum probe parallelization",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "256",
                "category": "timing",
                "order": 94
            },
            {
                "name": "min_rtt_timeout",
                "short_flag": None,
                "long_flag": "--min-rtt-timeout",
                "description": "Minimum probe round trip time",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "100ms",
                "category": "timing",
                "order": 95
            },
            {
                "name": "max_rtt_timeout",
                "short_flag": None,
                "long_flag": "--max-rtt-timeout",
                "description": "Maximum probe round trip time",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "2000ms",
                "category": "timing",
                "order": 96
            },
            {
                "name": "initial_rtt_timeout",
                "short_flag": None,
                "long_flag": "--initial-rtt-timeout",
                "description": "Initial probe RTT guess",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "500ms",
                "category": "timing",
                "order": 97
            },
            {
                "name": "max_retries",
                "short_flag": None,
                "long_flag": "--max-retries",
                "description": "Maximum number of port scan probe retransmissions",
                "value_type": "integer",
                "required": False,
                "default_value": 10,
                "example_value": "3",
                "category": "timing",
                "order": 98
            },
            {
                "name": "host_timeout",
                "short_flag": None,
                "long_flag": "--host-timeout",
                "description": "Give up on target after this long",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "30m",
                "category": "timing",
                "order": 99
            },
            {
                "name": "scan_delay",
                "short_flag": None,
                "long_flag": "--scan-delay",
                "description": "Adjust delay between probes",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "1s",
                "category": "timing",
                "order": 100
            },
            {
                "name": "max_scan_delay",
                "short_flag": None,
                "long_flag": "--max-scan-delay",
                "description": "Maximum probe delay",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "10s",
                "category": "timing",
                "order": 101
            },
            {
                "name": "min_rate",
                "short_flag": None,
                "long_flag": "--min-rate",
                "description": "Send packets no slower than <number> per second",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "100",
                "category": "timing",
                "order": 102
            },
            {
                "name": "max_rate",
                "short_flag": None,
                "long_flag": "--max-rate",
                "description": "Send packets no faster than <number> per second",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "1000",
                "category": "timing",
                "order": 103
            },
            
            # FIREWALL/IDS EVASION
            {
                "name": "fragment",
                "short_flag": "-f",
                "long_flag": None,
                "description": "Fragment packets (optionally with given MTU)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "evasion",
                "order": 110
            },
            {
                "name": "mtu",
                "short_flag": None,
                "long_flag": "--mtu",
                "description": "Specify custom MTU for fragmentation",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "24",
                "category": "evasion",
                "order": 111
            },
            {
                "name": "decoy",
                "short_flag": "-D",
                "long_flag": None,
                "description": "Cloak scan with decoys",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "ME,192.168.1.100,192.168.1.101",
                "category": "evasion",
                "order": 112
            },
            {
                "name": "spoof_source",
                "short_flag": "-S",
                "long_flag": None,
                "description": "Spoof source address",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "192.168.1.50",
                "category": "evasion",
                "order": 113
            },
            {
                "name": "interface",
                "short_flag": "-e",
                "long_flag": None,
                "description": "Use specified interface",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "eth0",
                "category": "evasion",
                "order": 114
            },
            {
                "name": "source_port",
                "short_flag": "-g",
                "long_flag": "--source-port",
                "description": "Use given port number as source",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "53",
                "category": "evasion",
                "order": 115
            },
            {
                "name": "proxies",
                "short_flag": None,
                "long_flag": "--proxies",
                "description": "Relay connections through HTTP/SOCKS4 proxies",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "http://proxy:8080",
                "category": "evasion",
                "order": 116
            },
            {
                "name": "data",
                "short_flag": None,
                "long_flag": "--data",
                "description": "Append custom binary data to packets",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "\\x01\\x02\\x03\\x04",
                "category": "evasion",
                "order": 117
            },
            {
                "name": "data_string",
                "short_flag": None,
                "long_flag": "--data-string",
                "description": "Append custom ASCII string to packets",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "Hello World",
                "category": "evasion",
                "order": 118
            },
            {
                "name": "data_length",
                "short_flag": None,
                "long_flag": "--data-length",
                "description": "Append random data to packets",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "100",
                "category": "evasion",
                "order": 119
            },
            {
                "name": "ip_options",
                "short_flag": None,
                "long_flag": "--ip-options",
                "description": "Send packets with specified IP options",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "L192.168.1.1",
                "category": "evasion",
                "order": 120
            },
            {
                "name": "ttl",
                "short_flag": None,
                "long_flag": "--ttl",
                "description": "Set IP time-to-live field",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "64",
                "category": "evasion",
                "order": 121
            },
            {
                "name": "spoof_mac",
                "short_flag": None,
                "long_flag": "--spoof-mac",
                "description": "Spoof MAC address",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "00:11:22:33:44:55",
                "category": "evasion",
                "order": 122
            },
            {
                "name": "badsum",
                "short_flag": None,
                "long_flag": "--badsum",
                "description": "Send packets with bogus TCP/UDP/SCTP checksum",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "evasion",
                "order": 123
            },
            
            # OUTPUT
            {
                "name": "output_normal",
                "short_flag": "-oN",
                "long_flag": None,
                "description": "Output scan in normal format to file",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "scan.txt",
                "category": "output",
                "order": 130
            },
            {
                "name": "output_xml",
                "short_flag": "-oX",
                "long_flag": None,
                "description": "Output scan in XML format to file",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "scan.xml",
                "category": "output",
                "order": 131
            },
            {
                "name": "output_script_kiddie",
                "short_flag": "-oS",
                "long_flag": None,
                "description": "Output scan in script kiddie format",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "scan.txt",
                "category": "output",
                "order": 132
            },
            {
                "name": "output_grepable",
                "short_flag": "-oG",
                "long_flag": None,
                "description": "Output scan in grepable format to file",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "scan.gnmap",
                "category": "output",
                "order": 133
            },
            {
                "name": "output_all",
                "short_flag": "-oA",
                "long_flag": None,
                "description": "Output in all formats (normal, XML, grepable)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "scan_results",
                "category": "output",
                "order": 134
            },
            {
                "name": "verbose",
                "short_flag": "-v",
                "long_flag": None,
                "description": "Increase verbosity level (use -vv or more for greater effect)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 135
            },
            {
                "name": "debug",
                "short_flag": "-d",
                "long_flag": None,
                "description": "Increase debugging level (use -dd or more)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 136
            },
            {
                "name": "reason",
                "short_flag": None,
                "long_flag": "--reason",
                "description": "Display the reason a port is in a particular state",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 137
            },
            {
                "name": "open",
                "short_flag": None,
                "long_flag": "--open",
                "description": "Only show open (or possibly open) ports",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 138
            },
            {
                "name": "packet_trace",
                "short_flag": None,
                "long_flag": "--packet-trace",
                "description": "Show all packets sent and received",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 139
            },
            {
                "name": "iflist",
                "short_flag": None,
                "long_flag": "--iflist",
                "description": "Print host interfaces and routes (for debugging)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 140
            },
            {
                "name": "append_output",
                "short_flag": None,
                "long_flag": "--append-output",
                "description": "Append to rather than clobber output files",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 141
            },
            {
                "name": "resume",
                "short_flag": None,
                "long_flag": "--resume",
                "description": "Resume an aborted scan",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "scan.txt",
                "category": "output",
                "order": 142
            },
            {
                "name": "stylesheet",
                "short_flag": None,
                "long_flag": "--stylesheet",
                "description": "XSL stylesheet to transform XML output",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "nmap.xsl",
                "category": "output",
                "order": 143
            },
            {
                "name": "webxml",
                "short_flag": None,
                "long_flag": "--webxml",
                "description": "Reference stylesheet from nmap.org for portable XML",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 144
            },
            {
                "name": "no_stylesheet",
                "short_flag": None,
                "long_flag": "--no-stylesheet",
                "description": "Prevent associating XSL stylesheet with XML output",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 145
            },
            
            # MISC
            {
                "name": "ipv6",
                "short_flag": "-6",
                "long_flag": None,
                "description": "Enable IPv6 scanning",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 150
            },
            {
                "name": "aggressive",
                "short_flag": "-A",
                "long_flag": None,
                "description": "Enable OS detection, version detection, script scanning, and traceroute",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 151
            },
            {
                "name": "datadir",
                "short_flag": None,
                "long_flag": "--datadir",
                "description": "Specify custom Nmap data file location",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "/usr/share/nmap",
                "category": "misc",
                "order": 152
            },
            {
                "name": "send_eth",
                "short_flag": None,
                "long_flag": "--send-eth",
                "description": "Send using raw ethernet frames",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 153
            },
            {
                "name": "send_ip",
                "short_flag": None,
                "long_flag": "--send-ip",
                "description": "Send using IP level",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 154
            },
            {
                "name": "privileged",
                "short_flag": None,
                "long_flag": "--privileged",
                "description": "Assume that the user is fully privileged",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 155
            },
            {
                "name": "unprivileged",
                "short_flag": None,
                "long_flag": "--unprivileged",
                "description": "Assume the user lacks raw socket privileges",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 156
            },
            {
                "name": "version",
                "short_flag": "-V",
                "long_flag": None,
                "description": "Print version number",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 157
            },
            {
                "name": "help",
                "short_flag": "-h",
                "long_flag": None,
                "description": "Print help summary page",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 158
            }
        ],
        "presets": [
            {
                "name": "Quick Scan",
                "description": "Fast scan of top 100 ports",
                "difficulty": "beginner",
                "category": "discovery",
                "parameters": {
                    "fast_scan": True,
                    "timing": 4
                }
            },
            {
                "name": "Intense Scan",
                "description": "Comprehensive scan with OS detection, version detection, scripts, and traceroute",
                "difficulty": "intermediate",
                "category": "comprehensive",
                "parameters": {
                    "aggressive": True,
                    "verbose": True
                }
            },
            {
                "name": "Stealth SYN Scan",
                "description": "Half-open scan that doesn't complete TCP connections",
                "difficulty": "intermediate",
                "category": "stealth",
                "parameters": {
                    "syn_scan": True,
                    "timing": 2,
                    "verbose": True
                }
            },
            {
                "name": "Full Port Scan",
                "description": "Scan all 65535 ports",
                "difficulty": "intermediate",
                "category": "comprehensive",
                "parameters": {
                    "ports": "1-65535",
                    "service_version": True,
                    "verbose": True
                }
            },
            {
                "name": "Ping Sweep",
                "description": "Discover live hosts without port scanning",
                "difficulty": "beginner",
                "category": "discovery",
                "parameters": {
                    "ping_scan": True
                }
            },
            {
                "name": "UDP Scan",
                "description": "Scan for open UDP ports",
                "difficulty": "intermediate",
                "category": "comprehensive",
                "parameters": {
                    "udp_scan": True,
                    "top_ports": 1000
                }
            },
            {
                "name": "Vulnerability Scan",
                "description": "Run vulnerability detection scripts",
                "difficulty": "advanced",
                "category": "security",
                "parameters": {
                    "script": "vuln",
                    "service_version": True
                }
            },
            {
                "name": "Firewall Evasion",
                "description": "Techniques to bypass basic firewalls",
                "difficulty": "advanced",
                "category": "stealth",
                "parameters": {
                    "fragment": True,
                    "timing": 1,
                    "decoy": "RND:10"
                }
            },
            {
                "name": "Service Detection",
                "description": "Identify services and versions on open ports",
                "difficulty": "beginner",
                "category": "discovery",
                "parameters": {
                    "service_version": True,
                    "version_intensity": 9
                }
            },
            {
                "name": "OS Fingerprinting",
                "description": "Determine operating system of target",
                "difficulty": "intermediate",
                "category": "discovery",
                "parameters": {
                    "os_detection": True,
                    "osscan_guess": True
                }
            }
        ],
        "examples": [
            {
                "title": "Basic Port Scan",
                "command": "nmap 192.168.1.1",
                "description": "Scan the top 1000 TCP ports on host"
            },
            {
                "title": "Scan Specific Ports",
                "command": "nmap -p 22,80,443 192.168.1.1",
                "description": "Scan only ports 22, 80, and 443"
            },
            {
                "title": "Scan Range of Ports",
                "command": "nmap -p 1-1000 192.168.1.1",
                "description": "Scan ports 1 through 1000"
            },
            {
                "title": "Fast Scan (Top 100 ports)",
                "command": "nmap -F 192.168.1.1",
                "description": "Quick scan of top 100 ports"
            },
            {
                "title": "All Ports",
                "command": "nmap -p- 192.168.1.1",
                "description": "Scan all 65535 ports"
            },
            {
                "title": "Service Version Detection",
                "command": "nmap -sV 192.168.1.1",
                "description": "Detect service versions on open ports"
            },
            {
                "title": "OS Detection",
                "command": "nmap -O 192.168.1.1",
                "description": "Detect operating system"
            },
            {
                "title": "Aggressive Scan",
                "command": "nmap -A 192.168.1.1",
                "description": "Enable OS detection, version detection, script scanning, and traceroute"
            },
            {
                "title": "TCP SYN Scan (Stealth)",
                "command": "nmap -sS 192.168.1.1",
                "description": "Half-open scan, stealthier than full connect"
            },
            {
                "title": "UDP Scan",
                "command": "nmap -sU 192.168.1.1",
                "description": "Scan UDP ports"
            },
            {
                "title": "Network Sweep",
                "command": "nmap -sn 192.168.1.0/24",
                "description": "Discover live hosts on network"
            },
            {
                "title": "Vulnerability Scripts",
                "command": "nmap --script vuln 192.168.1.1",
                "description": "Run vulnerability detection scripts"
            },
            {
                "title": "Save Output (All Formats)",
                "command": "nmap -oA scan_results 192.168.1.1",
                "description": "Save output in normal, XML, and grepable formats"
            },
            {
                "title": "Timing (Faster)",
                "command": "nmap -T4 192.168.1.1",
                "description": "Use aggressive timing template"
            },
            {
                "title": "Skip Host Discovery",
                "command": "nmap -Pn 192.168.1.1",
                "description": "Scan even if host appears down"
            }
        ],
        "related_tools": ["masscan", "rustscan", "zmap", "unicornscan", "netcat"]
    },
    
    # ========================================
    # NIKTO - Web Server Scanner
    # ========================================
    "nikto": {
        "name": "Nikto",
        "slug": "nikto",
        "category": "Web Applications",
        "subcategory": "Vulnerability Scanner",
        "description": "Web server scanner which performs comprehensive tests against web servers",
        "long_description": """Nikto is an Open Source (GPL) web server scanner which performs comprehensive tests against web servers for multiple items, including over 6700 potentially dangerous files/programs, checks for outdated versions of over 1250 servers, and version specific problems on over 270 servers.

It also checks for server configuration items such as the presence of multiple index files, HTTP server options, and will attempt to identify installed web servers and software. Scan items and plugins are frequently updated and can be automatically updated.

Nikto is not designed as a stealthy tool. It will test a web server in the quickest time possible, and is obvious in log files or to an IPS/IDS.""",
        "author": "Chris Sullo, David Lodge",
        "version": "2.5.0",
        "license": "GPL-2.0",
        "homepage": "https://cirt.net/Nikto2",
        "repository": "https://github.com/sullo/nikto",
        "documentation_url": "https://github.com/sullo/nikto/wiki",
        "plan_required": "starter",
        "installation": "apt install nikto",
        "docker_image": "securecodebox/nikto",
        "command_template": "nikto {options}",
        "tags": ["web", "scanner", "vulnerability", "server", "security"],
        "parameters": [
            {
                "name": "host",
                "short_flag": "-h",
                "long_flag": "-host",
                "description": "Target host(s) to scan. Can be IP address, hostname or URL",
                "value_type": "string",
                "required": True,
                "default_value": None,
                "example_value": "http://example.com",
                "category": "target",
                "order": 1
            },
            {
                "name": "port",
                "short_flag": "-p",
                "long_flag": "-port",
                "description": "Port(s) to scan. Default is 80",
                "value_type": "string",
                "required": False,
                "default_value": "80",
                "example_value": "80,443,8080",
                "category": "target",
                "order": 2
            },
            {
                "name": "ssl",
                "short_flag": "-ssl",
                "long_flag": None,
                "description": "Force SSL mode on port(s)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "target",
                "order": 3
            },
            {
                "name": "nossl",
                "short_flag": "-nossl",
                "long_flag": None,
                "description": "Disable SSL mode",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "target",
                "order": 4
            },
            {
                "name": "vhost",
                "short_flag": "-vhost",
                "long_flag": None,
                "description": "Virtual host (for Host header)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "www.example.com",
                "category": "target",
                "order": 5
            },
            {
                "name": "root",
                "short_flag": "-root",
                "long_flag": None,
                "description": "Prepend root value to all requests",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "/app",
                "category": "target",
                "order": 6
            },
            {
                "name": "tuning",
                "short_flag": "-T",
                "long_flag": "-Tuning",
                "description": "Scan tuning. 0=File Upload, 1=Interesting File, 2=Misconfiguration, 3=Information Disclosure, 4=Injection (XSS/Script/HTML), 5=Remote File Retrieval - Inside Web Root, 6=Denial of Service, 7=Remote File Retrieval - Server Wide, 8=Command Execution, 9=SQL Injection, a=Authentication Bypass, b=Software Identification, c=Remote Source Inclusion, d=WebService, e=Administrative Console, x=Reverse Tuning Options",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "123b",
                "category": "scan_options",
                "order": 10
            },
            {
                "name": "plugins",
                "short_flag": "-Plugins",
                "long_flag": None,
                "description": "List of plugins to run (default: ALL)",
                "value_type": "string",
                "required": False,
                "default_value": "ALL",
                "example_value": "apacheusers;cookies",
                "category": "scan_options",
                "order": 11
            },
            {
                "name": "evasion",
                "short_flag": "-e",
                "long_flag": "-evasion",
                "description": "Encoding/evasion technique. 1=Random URI encoding (non-UTF8), 2=Directory self-reference (/./)., 3=Premature URL ending, 4=Prepend long random string, 5=Fake parameter, 6=TAB as request spacer, 7=Change the case of the URL, 8=Use Windows directory separator (\\), A=Use a carriage return (0x0d), B=Use binary value 0x0b",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "1",
                "category": "scan_options",
                "order": 12
            },
            {
                "name": "useragent",
                "short_flag": "-useragent",
                "long_flag": None,
                "description": "Custom User-Agent string",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "Mozilla/5.0",
                "category": "request",
                "order": 20
            },
            {
                "name": "useproxy",
                "short_flag": "-useproxy",
                "long_flag": None,
                "description": "Use the proxy defined in nikto.conf",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "request",
                "order": 21
            },
            {
                "name": "timeout",
                "short_flag": "-timeout",
                "long_flag": None,
                "description": "Timeout for requests (default 10 seconds)",
                "value_type": "integer",
                "required": False,
                "default_value": 10,
                "example_value": "30",
                "category": "request",
                "order": 22
            },
            {
                "name": "pause",
                "short_flag": "-Pause",
                "long_flag": None,
                "description": "Pause between tests (seconds)",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "3",
                "category": "request",
                "order": 23
            },
            {
                "name": "maxtime",
                "short_flag": "-maxtime",
                "long_flag": None,
                "description": "Maximum testing time per host (e.g., 1h, 30m)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "1h",
                "category": "request",
                "order": 24
            },
            {
                "name": "mutate",
                "short_flag": "-mutate",
                "long_flag": None,
                "description": "Mutate checks. 1=Test all files with all root dirs, 2=Guess for password file names, 3=Enumerate user names via Apache (/~user), 4=Enumerate user names via cgiwrap (/cgi-bin/cgiwrap/~user), 5=Attempt to brute force sub-domain names, 6=Attempt to guess directory names from the supplied dictionary file",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "1235",
                "category": "scan_options",
                "order": 25
            },
            {
                "name": "mutate_options",
                "short_flag": "-mutate-options",
                "long_flag": None,
                "description": "Provide information for mutates",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "dictionary.txt",
                "category": "scan_options",
                "order": 26
            },
            {
                "name": "output",
                "short_flag": "-o",
                "long_flag": "-output",
                "description": "Write output to this file",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "report.html",
                "category": "output",
                "order": 30
            },
            {
                "name": "format",
                "short_flag": "-F",
                "long_flag": "-Format",
                "description": "Output format (csv, htm, msf+, nbe, sql, txt, xml, json)",
                "value_type": "string",
                "required": False,
                "default_value": "txt",
                "example_value": "html",
                "category": "output",
                "order": 31
            },
            {
                "name": "display",
                "short_flag": "-D",
                "long_flag": "-Display",
                "description": "Display options. 1=Show redirects, 2=Show cookies received, 3=Show all 200/OK responses, 4=Show URLs which require authentication, D=Debug output, E=Display all HTTP errors, P=Print progress, S=Scrub output of IPs and hostnames, V=Verbose output",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "V",
                "category": "output",
                "order": 32
            },
            {
                "name": "no404",
                "short_flag": "-no404",
                "long_flag": None,
                "description": "Disables nikto attempting to guess a 404 page",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_options",
                "order": 40
            },
            {
                "name": "nocache",
                "short_flag": "-nocache",
                "long_flag": None,
                "description": "Disable the response cache",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_options",
                "order": 41
            },
            {
                "name": "nointeractive",
                "short_flag": "-nointeractive",
                "long_flag": None,
                "description": "Disables interactive features",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_options",
                "order": 42
            },
            {
                "name": "ask",
                "short_flag": "-ask",
                "long_flag": None,
                "description": "Whether to ask about submitting updates (yes/no/auto)",
                "value_type": "string",
                "required": False,
                "default_value": "yes",
                "example_value": "no",
                "category": "misc",
                "order": 50
            },
            {
                "name": "update",
                "short_flag": "-update",
                "long_flag": None,
                "description": "Update databases and plugins from CIRT.net",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 51
            },
            {
                "name": "version",
                "short_flag": "-Version",
                "long_flag": None,
                "description": "Print Nikto version information",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 52
            },
            {
                "name": "help",
                "short_flag": "-Help",
                "long_flag": None,
                "description": "Print help information",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 53
            },
            {
                "name": "id",
                "short_flag": "-id",
                "long_flag": None,
                "description": "HTTP Authentication credentials (format: id:password)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "admin:password",
                "category": "authentication",
                "order": 60
            },
            {
                "name": "404code",
                "short_flag": "-404code",
                "long_flag": None,
                "description": "Ignore these HTTP codes as negative responses (treated as a 404)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "500",
                "category": "scan_options",
                "order": 61
            },
            {
                "name": "404string",
                "short_flag": "-404string",
                "long_flag": None,
                "description": "Ignore this string in response body (treated as a 404)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "Page not found",
                "category": "scan_options",
                "order": 62
            },
            {
                "name": "list_plugins",
                "short_flag": "-list-plugins",
                "long_flag": None,
                "description": "List all available plugins",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 63
            },
            {
                "name": "dbcheck",
                "short_flag": "-dbcheck",
                "long_flag": None,
                "description": "Check database and other key files for syntax errors",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 64
            },
            {
                "name": "followredirects",
                "short_flag": "-followredirects",
                "long_flag": None,
                "description": "Follow redirects (yes/no/auto)",
                "value_type": "string",
                "required": False,
                "default_value": "auto",
                "example_value": "yes",
                "category": "request",
                "order": 65
            },
            {
                "name": "single",
                "short_flag": "-Single",
                "long_flag": None,
                "description": "Single request mode (only test one item per request)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "scan_options",
                "order": 66
            },
            {
                "name": "until",
                "short_flag": "-until",
                "long_flag": None,
                "description": "Run until the specified time or duration",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "14:00",
                "category": "scan_options",
                "order": 67
            }
        ],
        "presets": [
            {
                "name": "Basic Web Scan",
                "description": "Standard comprehensive web server scan",
                "difficulty": "beginner",
                "category": "general",
                "parameters": {
                    "display": "V"
                }
            },
            {
                "name": "Quick Scan",
                "description": "Fast scan focusing on common vulnerabilities",
                "difficulty": "beginner",
                "category": "discovery",
                "parameters": {
                    "tuning": "1b",
                    "maxtime": "10m"
                }
            },
            {
                "name": "Full Vulnerability Scan",
                "description": "Complete vulnerability assessment",
                "difficulty": "intermediate",
                "category": "security",
                "parameters": {
                    "tuning": "x",
                    "display": "V"
                }
            },
            {
                "name": "SQL Injection Focus",
                "description": "Focus on SQL injection vulnerabilities",
                "difficulty": "advanced",
                "category": "security",
                "parameters": {
                    "tuning": "9"
                }
            },
            {
                "name": "XSS/Injection Focus",
                "description": "Focus on XSS and injection vulnerabilities",
                "difficulty": "advanced",
                "category": "security",
                "parameters": {
                    "tuning": "4"
                }
            },
            {
                "name": "Evasive Scan",
                "description": "Use evasion techniques to bypass basic filters",
                "difficulty": "advanced",
                "category": "stealth",
                "parameters": {
                    "evasion": "1",
                    "pause": 2
                }
            },
            {
                "name": "SSL Scan",
                "description": "Scan HTTPS services",
                "difficulty": "beginner",
                "category": "discovery",
                "parameters": {
                    "ssl": True,
                    "port": "443"
                }
            },
            {
                "name": "Report Generation",
                "description": "Generate HTML report with findings",
                "difficulty": "beginner",
                "category": "reporting",
                "parameters": {
                    "format": "htm",
                    "display": "V"
                }
            }
        ],
        "examples": [
            {
                "title": "Basic Scan",
                "command": "nikto -h http://example.com",
                "description": "Simple scan against a target"
            },
            {
                "title": "Scan with SSL",
                "command": "nikto -h https://example.com -ssl",
                "description": "Scan an HTTPS site"
            },
            {
                "title": "Scan Multiple Ports",
                "command": "nikto -h example.com -p 80,443,8080",
                "description": "Scan multiple ports on a host"
            },
            {
                "title": "Save HTML Report",
                "command": "nikto -h example.com -o report.html -F htm",
                "description": "Generate HTML report"
            },
            {
                "title": "Tuned Scan",
                "command": "nikto -h example.com -T 12",
                "description": "Focus on file upload and interesting files"
            },
            {
                "title": "With Authentication",
                "command": "nikto -h example.com -id admin:password",
                "description": "Scan with HTTP Basic Authentication"
            },
            {
                "title": "Evasion Mode",
                "command": "nikto -h example.com -e 1",
                "description": "Use random URI encoding evasion"
            },
            {
                "title": "Verbose Output",
                "command": "nikto -h example.com -D V",
                "description": "Show verbose output during scan"
            }
        ],
        "related_tools": ["wapiti", "skipfish", "wfuzz", "dirb", "gobuster"]
    },
    
    # ========================================
    # SQLMAP - SQL Injection Tool
    # ========================================
    "sqlmap": {
        "name": "SQLMap",
        "slug": "sqlmap",
        "category": "Web Applications",
        "subcategory": "SQL Injection",
        "description": "Automatic SQL injection and database takeover tool",
        "long_description": """sqlmap is an open source penetration testing tool that automates the process of detecting and exploiting SQL injection flaws and taking over database servers. It comes with a powerful detection engine, many niche features for the ultimate penetration tester, and a broad range of switches including database fingerprinting, data fetching, accessing the underlying file system, and executing commands on the operating system via out-of-band connections.

Features include full support for MySQL, Oracle, PostgreSQL, Microsoft SQL Server, Microsoft Access, IBM DB2, SQLite, Firebird, Sybase, SAP MaxDB, Informix, MariaDB, MemSQL, TiDB, CockroachDB, HSQLDB, H2, MonetDB, Apache Derby, Amazon Redshift, Vertica, Mckoi, Presto, Altibase, MimerSQL, CrateDB, Greenplum, Drizzle, Apache Ignite, Cubrid, InterSystems Cache, IRIS, eXtremeDB, FrontBase and more.""",
        "author": "Bernardo Damele A. G., Miroslav Stampar",
        "version": "1.7.12",
        "license": "GPL-2.0",
        "homepage": "https://sqlmap.org",
        "repository": "https://github.com/sqlmapproject/sqlmap",
        "documentation_url": "https://github.com/sqlmapproject/sqlmap/wiki",
        "plan_required": "professional",
        "installation": "apt install sqlmap",
        "docker_image": "paoloo/sqlmap",
        "command_template": "sqlmap {options}",
        "tags": ["sql", "injection", "database", "web", "exploitation", "pentest"],
        "parameters": [
            # Target
            {
                "name": "url",
                "short_flag": "-u",
                "long_flag": "--url",
                "description": "Target URL (e.g. 'http://www.site.com/vuln.php?id=1')",
                "value_type": "string",
                "required": True,
                "default_value": None,
                "example_value": "http://example.com/page.php?id=1",
                "category": "target",
                "order": 1
            },
            {
                "name": "data",
                "short_flag": None,
                "long_flag": "--data",
                "description": "Data string to be sent through POST (e.g. 'id=1')",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "username=admin&password=test",
                "category": "target",
                "order": 2
            },
            {
                "name": "cookie",
                "short_flag": None,
                "long_flag": "--cookie",
                "description": "HTTP Cookie header value (e.g. 'PHPSESSID=a8d127e..')",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "PHPSESSID=abc123",
                "category": "request",
                "order": 3
            },
            {
                "name": "random_agent",
                "short_flag": None,
                "long_flag": "--random-agent",
                "description": "Use randomly selected HTTP User-Agent header value",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "request",
                "order": 4
            },
            {
                "name": "proxy",
                "short_flag": None,
                "long_flag": "--proxy",
                "description": "Use a proxy to connect to the target URL",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "http://127.0.0.1:8080",
                "category": "request",
                "order": 5
            },
            {
                "name": "tor",
                "short_flag": None,
                "long_flag": "--tor",
                "description": "Use Tor anonymity network",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "request",
                "order": 6
            },
            
            # Injection
            {
                "name": "param",
                "short_flag": "-p",
                "long_flag": None,
                "description": "Testable parameter(s)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "id",
                "category": "injection",
                "order": 10
            },
            {
                "name": "dbms",
                "short_flag": None,
                "long_flag": "--dbms",
                "description": "Force back-end DBMS to provided value",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "MySQL",
                "category": "injection",
                "order": 11
            },
            {
                "name": "technique",
                "short_flag": None,
                "long_flag": "--technique",
                "description": "SQL injection techniques to use (B:Boolean,E:Error,U:Union,S:Stacked,T:Time,Q:Inline)",
                "value_type": "string",
                "required": False,
                "default_value": "BEUSTQ",
                "example_value": "BEU",
                "category": "injection",
                "order": 12
            },
            {
                "name": "level",
                "short_flag": None,
                "long_flag": "--level",
                "description": "Level of tests to perform (1-5, default 1)",
                "value_type": "integer",
                "required": False,
                "default_value": 1,
                "example_value": "5",
                "category": "injection",
                "order": 13
            },
            {
                "name": "risk",
                "short_flag": None,
                "long_flag": "--risk",
                "description": "Risk of tests to perform (1-3, default 1)",
                "value_type": "integer",
                "required": False,
                "default_value": 1,
                "example_value": "3",
                "category": "injection",
                "order": 14
            },
            
            # Enumeration
            {
                "name": "dbs",
                "short_flag": None,
                "long_flag": "--dbs",
                "description": "Enumerate DBMS databases",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "enumeration",
                "order": 20
            },
            {
                "name": "tables",
                "short_flag": None,
                "long_flag": "--tables",
                "description": "Enumerate DBMS database tables",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "enumeration",
                "order": 21
            },
            {
                "name": "columns",
                "short_flag": None,
                "long_flag": "--columns",
                "description": "Enumerate DBMS database table columns",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "enumeration",
                "order": 22
            },
            {
                "name": "dump",
                "short_flag": None,
                "long_flag": "--dump",
                "description": "Dump DBMS database table entries",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "enumeration",
                "order": 23
            },
            {
                "name": "dump_all",
                "short_flag": None,
                "long_flag": "--dump-all",
                "description": "Dump all DBMS databases tables entries",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "enumeration",
                "order": 24
            },
            {
                "name": "database",
                "short_flag": "-D",
                "long_flag": None,
                "description": "DBMS database to enumerate",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "mydb",
                "category": "enumeration",
                "order": 25
            },
            {
                "name": "table",
                "short_flag": "-T",
                "long_flag": None,
                "description": "DBMS database table(s) to enumerate",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "users",
                "category": "enumeration",
                "order": 26
            },
            {
                "name": "column",
                "short_flag": "-C",
                "long_flag": None,
                "description": "DBMS database table column(s) to enumerate",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "username,password",
                "category": "enumeration",
                "order": 27
            },
            {
                "name": "users",
                "short_flag": None,
                "long_flag": "--users",
                "description": "Enumerate DBMS users",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "enumeration",
                "order": 28
            },
            {
                "name": "passwords",
                "short_flag": None,
                "long_flag": "--passwords",
                "description": "Enumerate DBMS users password hashes",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "enumeration",
                "order": 29
            },
            {
                "name": "current_user",
                "short_flag": None,
                "long_flag": "--current-user",
                "description": "Retrieve DBMS current user",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "enumeration",
                "order": 30
            },
            {
                "name": "current_db",
                "short_flag": None,
                "long_flag": "--current-db",
                "description": "Retrieve DBMS current database",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "enumeration",
                "order": 31
            },
            {
                "name": "is_dba",
                "short_flag": None,
                "long_flag": "--is-dba",
                "description": "Detect if the DBMS current user is DBA",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "enumeration",
                "order": 32
            },
            
            # Operating System Access
            {
                "name": "os_shell",
                "short_flag": None,
                "long_flag": "--os-shell",
                "description": "Prompt for an interactive operating system shell",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "os_access",
                "order": 40
            },
            {
                "name": "os_cmd",
                "short_flag": None,
                "long_flag": "--os-cmd",
                "description": "Execute an operating system command",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "whoami",
                "category": "os_access",
                "order": 41
            },
            {
                "name": "file_read",
                "short_flag": None,
                "long_flag": "--file-read",
                "description": "Read a file from the back-end DBMS file system",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "/etc/passwd",
                "category": "os_access",
                "order": 42
            },
            {
                "name": "file_write",
                "short_flag": None,
                "long_flag": "--file-write",
                "description": "Write a local file on the back-end DBMS file system",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "shell.php",
                "category": "os_access",
                "order": 43
            },
            {
                "name": "file_dest",
                "short_flag": None,
                "long_flag": "--file-dest",
                "description": "Back-end DBMS absolute filepath to write to",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "/var/www/shell.php",
                "category": "os_access",
                "order": 44
            },
            
            # General
            {
                "name": "batch",
                "short_flag": None,
                "long_flag": "--batch",
                "description": "Never ask for user input, use the default behavior",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "general",
                "order": 50
            },
            {
                "name": "verbose",
                "short_flag": "-v",
                "long_flag": None,
                "description": "Verbosity level: 0-6 (default 1)",
                "value_type": "integer",
                "required": False,
                "default_value": 1,
                "example_value": "3",
                "category": "general",
                "order": 51
            },
            {
                "name": "threads",
                "short_flag": None,
                "long_flag": "--threads",
                "description": "Max number of concurrent HTTP(s) requests (default 1)",
                "value_type": "integer",
                "required": False,
                "default_value": 1,
                "example_value": "10",
                "category": "general",
                "order": 52
            },
            {
                "name": "output_dir",
                "short_flag": None,
                "long_flag": "--output-dir",
                "description": "Custom output directory path",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "/tmp/sqlmap_output",
                "category": "general",
                "order": 53
            },
            {
                "name": "forms",
                "short_flag": None,
                "long_flag": "--forms",
                "description": "Parse and test forms on target URL",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "target",
                "order": 54
            },
            {
                "name": "crawl",
                "short_flag": None,
                "long_flag": "--crawl",
                "description": "Crawl the website starting from the target URL",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "3",
                "category": "target",
                "order": 55
            },
            {
                "name": "tamper",
                "short_flag": None,
                "long_flag": "--tamper",
                "description": "Use given script(s) for tampering injection data",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "space2comment,between",
                "category": "injection",
                "order": 56
            },
            {
                "name": "flush_session",
                "short_flag": None,
                "long_flag": "--flush-session",
                "description": "Flush session files for current target",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "general",
                "order": 57
            },
            {
                "name": "wizard",
                "short_flag": None,
                "long_flag": "--wizard",
                "description": "Simple wizard interface for beginner users",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "general",
                "order": 58
            }
        ],
        "presets": [
            {
                "name": "Basic Detection",
                "description": "Simple SQL injection detection",
                "difficulty": "beginner",
                "category": "discovery",
                "parameters": {
                    "batch": True
                }
            },
            {
                "name": "Database Enumeration",
                "description": "List all databases",
                "difficulty": "beginner",
                "category": "enumeration",
                "parameters": {
                    "dbs": True,
                    "batch": True
                }
            },
            {
                "name": "Full Enumeration",
                "description": "Dump all tables from all databases",
                "difficulty": "intermediate",
                "category": "enumeration",
                "parameters": {
                    "dump_all": True,
                    "batch": True
                }
            },
            {
                "name": "Deep Scan",
                "description": "Thorough scan with high level and risk",
                "difficulty": "advanced",
                "category": "discovery",
                "parameters": {
                    "level": 5,
                    "risk": 3,
                    "batch": True
                }
            },
            {
                "name": "WAF Bypass",
                "description": "Use tamper scripts to bypass WAF",
                "difficulty": "advanced",
                "category": "evasion",
                "parameters": {
                    "tamper": "space2comment,between,randomcase",
                    "random_agent": True
                }
            },
            {
                "name": "OS Shell",
                "description": "Get operating system shell access",
                "difficulty": "advanced",
                "category": "exploitation",
                "parameters": {
                    "os_shell": True,
                    "batch": True
                }
            },
            {
                "name": "Password Extraction",
                "description": "Extract database user password hashes",
                "difficulty": "intermediate",
                "category": "enumeration",
                "parameters": {
                    "passwords": True,
                    "batch": True
                }
            },
            {
                "name": "Form Testing",
                "description": "Test forms on target page",
                "difficulty": "beginner",
                "category": "discovery",
                "parameters": {
                    "forms": True,
                    "batch": True
                }
            }
        ],
        "examples": [
            {
                "title": "Basic Injection Test",
                "command": "sqlmap -u 'http://example.com/page.php?id=1'",
                "description": "Test URL parameter for SQL injection"
            },
            {
                "title": "List Databases",
                "command": "sqlmap -u 'http://example.com/page.php?id=1' --dbs",
                "description": "Enumerate available databases"
            },
            {
                "title": "List Tables",
                "command": "sqlmap -u 'http://example.com/page.php?id=1' -D mydb --tables",
                "description": "List tables in specific database"
            },
            {
                "title": "Dump Table",
                "command": "sqlmap -u 'http://example.com/page.php?id=1' -D mydb -T users --dump",
                "description": "Dump contents of users table"
            },
            {
                "title": "POST Data",
                "command": "sqlmap -u 'http://example.com/login.php' --data='user=admin&pass=test'",
                "description": "Test POST parameters"
            },
            {
                "title": "With Cookie",
                "command": "sqlmap -u 'http://example.com/page.php?id=1' --cookie='PHPSESSID=abc123'",
                "description": "Include session cookie"
            },
            {
                "title": "Through Proxy",
                "command": "sqlmap -u 'http://example.com/page.php?id=1' --proxy='http://127.0.0.1:8080'",
                "description": "Route through Burp Suite or similar"
            },
            {
                "title": "OS Shell",
                "command": "sqlmap -u 'http://example.com/page.php?id=1' --os-shell",
                "description": "Get interactive OS shell"
            }
        ],
        "related_tools": ["burpsuite", "havij", "jsql", "mole"]
    }
}

# Tool categories with descriptions
TOOL_CATEGORIES = {
    "Information Gathering": {
        "description": "Collect information about targets",
        "icon": "🔍",
        "subcategories": ["DNS Analysis", "Route Analysis", "SMB Analysis", "SMTP Analysis", "SNMP Analysis", "SSL Analysis", "Live Host Identification", "Network & Port Scanners", "OSINT Analysis", "IDS/IPS Identification"]
    },
    "Web Applications": {
        "description": "Test web application security",
        "icon": "🌐",
        "subcategories": ["CMS & Framework Identification", "Web Application Proxies", "Web Crawlers & Directory Bruteforce", "Web Vulnerability Scanners", "SQL Injection"]
    },
    "Vulnerability Analysis": {
        "description": "Identify security vulnerabilities",
        "icon": "⚠️",
        "subcategories": ["Cisco Tools", "Fuzzing Tools", "VoIP Tools", "Nessus", "OpenVAS"]
    },
    "Exploitation Tools": {
        "description": "Exploit discovered vulnerabilities",
        "icon": "💥",
        "subcategories": ["Metasploit", "Social Engineering Toolkit", "BeEF", "Exploit Database"]
    },
    "Password Attacks": {
        "description": "Crack and recover passwords",
        "icon": "🔐",
        "subcategories": ["Offline Attacks", "Online Attacks", "Passing the Hash", "Password Profiling & Wordlists"]
    },
    "Wireless Attacks": {
        "description": "Test wireless network security",
        "icon": "📶",
        "subcategories": ["802.11 Wireless Tools", "Bluetooth Tools", "RFID/NFC Tools"]
    },
    "Forensics": {
        "description": "Digital forensics and analysis",
        "icon": "🔬",
        "subcategories": ["Anti-Forensics", "Forensic Imaging Tools", "PDF Forensics Tools", "Sleuth Kit Suite"]
    },
    "Reverse Engineering": {
        "description": "Analyze and reverse engineer binaries",
        "icon": "⚙️",
        "subcategories": ["Debuggers", "Disassemblers", "Binary Analysis"]
    },
    "Sniffing & Spoofing": {
        "description": "Network traffic analysis and manipulation",
        "icon": "👁️",
        "subcategories": ["Network Sniffers", "Spoofing & MITM", "Packet Crafting"]
    },
    "Social Engineering": {
        "description": "Human-based attack techniques",
        "icon": "🎭",
        "subcategories": ["Phishing Tools", "Credential Harvesting"]
    },
    "Post Exploitation": {
        "description": "Maintain access and pivot",
        "icon": "🚀",
        "subcategories": ["OS Backdoors", "Tunneling & Exfiltration", "Web Backdoors"]
    },
    "Reporting Tools": {
        "description": "Generate security reports",
        "icon": "📊",
        "subcategories": ["Evidence Management", "Report Writing"]
    },
    "Hardware Hacking": {
        "description": "Physical and hardware security testing",
        "icon": "🔧",
        "subcategories": ["Android Tools", "Arduino Tools"]
    },
    "Stress Testing": {
        "description": "Load and stress testing",
        "icon": "📈",
        "subcategories": ["VoIP Tools", "Web Stress Testing", "Network Stress Testing"]
    },
    "Maintaining Access": {
        "description": "Persistence and backdoor tools",
        "icon": "🔒",
        "subcategories": ["OS Backdoors", "Web Backdoors", "Tunneling Tools"]
    }
}

def get_tool_by_slug(slug):
    """Get tool by slug"""
    return KALI_TOOLS_COMPLETE.get(slug)

def get_all_tools():
    """Get all tools"""
    return KALI_TOOLS_COMPLETE

def get_tools_by_category(category):
    """Get tools by category"""
    return {k: v for k, v in KALI_TOOLS_COMPLETE.items() if v.get('category') == category}

def get_tool_parameters(slug):
    """Get parameters for a specific tool"""
    tool = KALI_TOOLS_COMPLETE.get(slug)
    if tool:
        return tool.get('parameters', [])
    return []

def get_tool_presets(slug):
    """Get presets for a specific tool"""
    tool = KALI_TOOLS_COMPLETE.get(slug)
    if tool:
        return tool.get('presets', [])
    return []

def build_command(slug, params):
    """Build command from tool slug and parameters"""
    tool = KALI_TOOLS_COMPLETE.get(slug)
    if not tool:
        return None
    
    command_parts = [tool['name'].lower()]
    
    for param in tool.get('parameters', []):
        param_name = param['name']
        if param_name in params and params[param_name] is not None:
            value = params[param_name]
            
            if param['value_type'] == 'boolean':
                if value:
                    flag = param.get('short_flag') or param.get('long_flag')
                    if flag:
                        command_parts.append(flag)
            else:
                flag = param.get('short_flag') or param.get('long_flag')
                if flag:
                    if param.get('short_flag'):
                        command_parts.append(f"{flag} {value}")
                    else:
                        command_parts.append(f"{flag}={value}")
                elif param_name == 'target':
                    command_parts.append(str(value))
    
    return ' '.join(command_parts)
