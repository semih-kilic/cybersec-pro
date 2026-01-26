#!/usr/bin/env python3
"""
🛡️ Additional Kali Linux Tools Database
Complete tool documentation for professional scanning
"""

ADDITIONAL_TOOLS = {
    # ========================================
    # HYDRA - Password Cracker
    # ========================================
    "hydra": {
        "name": "Hydra",
        "slug": "hydra",
        "category": "Password Attacks",
        "subcategory": "Online Attacks",
        "description": "Fast and flexible online password cracking tool",
        "long_description": """Hydra is a parallelized login cracker which supports numerous protocols to attack. It is very fast and flexible, and new modules are easy to add. This tool makes it possible for researchers and security consultants to show how easy it would be to gain unauthorized access to a system remotely.

It supports: Cisco AAA, Cisco auth, Cisco enable, CVS, FTP, HTTP(S)-FORM-GET, HTTP(S)-FORM-POST, HTTP(S)-GET, HTTP(S)-HEAD, HTTP-Proxy, ICQ, IMAP, IRC, LDAP, MS-SQL, MySQL, NNTP, Oracle Listener, Oracle SID, PC-Anywhere, PC-NFS, POP3, PostgreSQL, RDP, Rexec, Rlogin, Rsh, SIP, SMB(NT), SMTP, SMTP Enum, SNMP v1+v2+v3, SOCKS5, SSH (v1 and v2), SSHKEY, Subversion, Teamspeak (TS2), Telnet, VMware-Auth, VNC and XMPP.""",
        "author": "Van Hauser, Roland Kessler",
        "version": "9.5",
        "license": "AGPL-3.0",
        "homepage": "https://github.com/vanhauser-thc/thc-hydra",
        "repository": "https://github.com/vanhauser-thc/thc-hydra",
        "documentation_url": "https://github.com/vanhauser-thc/thc-hydra/blob/master/README.md",
        "plan_required": "professional",
        "installation": "apt install hydra",
        "docker_image": "vanhauser/hydra",
        "command_template": "hydra {options} {target} {protocol}",
        "tags": ["password", "brute-force", "cracking", "authentication", "pentest"],
        "parameters": [
            {
                "name": "login",
                "short_flag": "-l",
                "long_flag": None,
                "description": "Single username to use",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "admin",
                "category": "credentials",
                "order": 1
            },
            {
                "name": "login_file",
                "short_flag": "-L",
                "long_flag": None,
                "description": "File containing usernames (one per line)",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "users.txt",
                "category": "credentials",
                "order": 2
            },
            {
                "name": "password",
                "short_flag": "-p",
                "long_flag": None,
                "description": "Single password to use",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "password123",
                "category": "credentials",
                "order": 3
            },
            {
                "name": "password_file",
                "short_flag": "-P",
                "long_flag": None,
                "description": "File containing passwords (one per line)",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "passwords.txt",
                "category": "credentials",
                "order": 4
            },
            {
                "name": "combo_file",
                "short_flag": "-C",
                "long_flag": None,
                "description": "Colon separated login:pass format file",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "combos.txt",
                "category": "credentials",
                "order": 5
            },
            {
                "name": "target",
                "short_flag": None,
                "long_flag": None,
                "description": "Target host or IP address",
                "value_type": "string",
                "required": True,
                "default_value": None,
                "example_value": "192.168.1.1",
                "category": "target",
                "order": 6
            },
            {
                "name": "port",
                "short_flag": "-s",
                "long_flag": None,
                "description": "Port to connect to (if different from default)",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "22",
                "category": "target",
                "order": 7
            },
            {
                "name": "protocol",
                "short_flag": None,
                "long_flag": None,
                "description": "Protocol to attack (ssh, ftp, http-get, etc.)",
                "value_type": "string",
                "required": True,
                "default_value": None,
                "example_value": "ssh",
                "category": "target",
                "order": 8
            },
            {
                "name": "tasks",
                "short_flag": "-t",
                "long_flag": None,
                "description": "Number of parallel tasks (default: 16)",
                "value_type": "integer",
                "required": False,
                "default_value": 16,
                "example_value": "64",
                "category": "performance",
                "order": 10
            },
            {
                "name": "wait",
                "short_flag": "-w",
                "long_flag": None,
                "description": "Wait time for responses (default: 32s)",
                "value_type": "integer",
                "required": False,
                "default_value": 32,
                "example_value": "10",
                "category": "performance",
                "order": 11
            },
            {
                "name": "timeout",
                "short_flag": "-W",
                "long_flag": None,
                "description": "Connection timeout per attempt",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "5",
                "category": "performance",
                "order": 12
            },
            {
                "name": "verbose",
                "short_flag": "-v",
                "long_flag": None,
                "description": "Verbose mode (show login+pass for each attempt)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 20
            },
            {
                "name": "very_verbose",
                "short_flag": "-V",
                "long_flag": None,
                "description": "Very verbose mode (show login+pass+detail for each attempt)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 21
            },
            {
                "name": "debug",
                "short_flag": "-d",
                "long_flag": None,
                "description": "Debug mode",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 22
            },
            {
                "name": "output_file",
                "short_flag": "-o",
                "long_flag": None,
                "description": "Write found login/password pairs to FILE",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "found.txt",
                "category": "output",
                "order": 23
            },
            {
                "name": "use_ssl",
                "short_flag": "-S",
                "long_flag": None,
                "description": "Connect via SSL",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "connection",
                "order": 30
            },
            {
                "name": "exit_on_first",
                "short_flag": "-f",
                "long_flag": None,
                "description": "Exit after the first found login/password pair per host",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 40
            },
            {
                "name": "exit_on_first_all",
                "short_flag": "-F",
                "long_flag": None,
                "description": "Exit after the first found login/password pair for any host",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 41
            },
            {
                "name": "restore",
                "short_flag": "-R",
                "long_flag": None,
                "description": "Restore a previous session",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 42
            },
            {
                "name": "ignore_restore",
                "short_flag": "-I",
                "long_flag": None,
                "description": "Ignore existing restore file (don't wait 10 seconds)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 43
            },
            {
                "name": "ipv6",
                "short_flag": "-6",
                "long_flag": None,
                "description": "Use IPv6 addresses",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "connection",
                "order": 44
            },
            {
                "name": "module_help",
                "short_flag": "-U",
                "long_flag": None,
                "description": "Show service module usage details",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "misc",
                "order": 45
            },
            {
                "name": "http_method",
                "short_flag": "-m",
                "long_flag": None,
                "description": "Module specific options (e.g., HTTP path)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "/admin/login.php:user=^USER^&pass=^PASS^:F=incorrect",
                "category": "http",
                "order": 50
            }
        ],
        "presets": [
            {
                "name": "SSH Brute Force",
                "description": "Attack SSH service with wordlist",
                "difficulty": "intermediate",
                "category": "brute_force",
                "parameters": {
                    "tasks": 4,
                    "protocol": "ssh",
                    "verbose": True
                }
            },
            {
                "name": "FTP Brute Force",
                "description": "Attack FTP service",
                "difficulty": "beginner",
                "category": "brute_force",
                "parameters": {
                    "protocol": "ftp",
                    "verbose": True
                }
            },
            {
                "name": "Web Form Attack",
                "description": "Attack web login forms",
                "difficulty": "advanced",
                "category": "web",
                "parameters": {
                    "protocol": "http-post-form",
                    "verbose": True
                }
            },
            {
                "name": "RDP Attack",
                "description": "Attack Remote Desktop Protocol",
                "difficulty": "intermediate",
                "category": "brute_force",
                "parameters": {
                    "protocol": "rdp",
                    "tasks": 1,
                    "verbose": True
                }
            }
        ],
        "examples": [
            {
                "title": "SSH Attack",
                "command": "hydra -l root -P passwords.txt 192.168.1.1 ssh",
                "description": "Brute force SSH with root user"
            },
            {
                "title": "FTP Attack",
                "command": "hydra -L users.txt -P passwords.txt ftp://192.168.1.1",
                "description": "Brute force FTP with user and password lists"
            },
            {
                "title": "HTTP POST Form",
                "command": "hydra -l admin -P passwords.txt 192.168.1.1 http-post-form '/login:user=^USER^&pass=^PASS^:F=failed'",
                "description": "Attack web login form"
            },
            {
                "title": "MySQL Attack",
                "command": "hydra -l root -P passwords.txt 192.168.1.1 mysql",
                "description": "Brute force MySQL database"
            },
            {
                "title": "SMB Attack",
                "command": "hydra -l administrator -P passwords.txt 192.168.1.1 smb",
                "description": "Brute force Windows SMB shares"
            }
        ],
        "related_tools": ["john", "hashcat", "medusa", "ncrack", "patator"]
    },
    
    # ========================================
    # GOBUSTER - Directory/DNS Brute Forcer
    # ========================================
    "gobuster": {
        "name": "Gobuster",
        "slug": "gobuster",
        "category": "Web Applications",
        "subcategory": "Web Crawlers & Directory Bruteforce",
        "description": "Directory/file & DNS busting tool written in Go",
        "long_description": """Gobuster is a tool used to brute-force URIs (directories and files) in web sites, DNS subdomains (with wildcard support), Virtual Host names on target web servers, Open Amazon S3 buckets, Open Google Cloud buckets, and TFTP servers.

Gobuster is written in Go and is extremely fast. Unlike other brute-forcers, Gobuster does not require a graphical user interface and runs entirely from the command line, making it ideal for scripting and automation.""",
        "author": "OJ Reeves",
        "version": "3.6",
        "license": "Apache-2.0",
        "homepage": "https://github.com/OJ/gobuster",
        "repository": "https://github.com/OJ/gobuster",
        "documentation_url": "https://github.com/OJ/gobuster/blob/master/README.md",
        "plan_required": "starter",
        "installation": "apt install gobuster",
        "docker_image": "ghcr.io/oj/gobuster:latest",
        "command_template": "gobuster {mode} {options}",
        "tags": ["directory", "brute-force", "web", "dns", "enumeration"],
        "parameters": [
            {
                "name": "mode",
                "short_flag": None,
                "long_flag": None,
                "description": "Mode of operation (dir, dns, vhost, fuzz, s3, gcs, tftp)",
                "value_type": "string",
                "required": True,
                "default_value": "dir",
                "example_value": "dir",
                "category": "mode",
                "order": 1
            },
            {
                "name": "url",
                "short_flag": "-u",
                "long_flag": "--url",
                "description": "Target URL",
                "value_type": "string",
                "required": True,
                "default_value": None,
                "example_value": "http://example.com",
                "category": "target",
                "order": 2
            },
            {
                "name": "wordlist",
                "short_flag": "-w",
                "long_flag": "--wordlist",
                "description": "Path to the wordlist",
                "value_type": "file",
                "required": True,
                "default_value": None,
                "example_value": "/usr/share/wordlists/dirb/common.txt",
                "category": "wordlist",
                "order": 3
            },
            {
                "name": "threads",
                "short_flag": "-t",
                "long_flag": "--threads",
                "description": "Number of concurrent threads (default 10)",
                "value_type": "integer",
                "required": False,
                "default_value": 10,
                "example_value": "50",
                "category": "performance",
                "order": 4
            },
            {
                "name": "extensions",
                "short_flag": "-x",
                "long_flag": "--extensions",
                "description": "File extensions to search for",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "php,html,txt",
                "category": "dir_mode",
                "order": 10
            },
            {
                "name": "status_codes",
                "short_flag": "-s",
                "long_flag": "--status-codes",
                "description": "Positive status codes (default: 200,204,301,302,307,401,403)",
                "value_type": "string",
                "required": False,
                "default_value": "200,204,301,302,307,401,403",
                "example_value": "200,301",
                "category": "dir_mode",
                "order": 11
            },
            {
                "name": "exclude_status",
                "short_flag": "-b",
                "long_flag": "--exclude-status-codes",
                "description": "Negative status codes (to exclude from results)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "404,500",
                "category": "dir_mode",
                "order": 12
            },
            {
                "name": "follow_redirects",
                "short_flag": "-r",
                "long_flag": "--follow-redirect",
                "description": "Follow redirects",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "dir_mode",
                "order": 13
            },
            {
                "name": "no_tls_validation",
                "short_flag": "-k",
                "long_flag": "--no-tls-validation",
                "description": "Skip TLS certificate verification",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "connection",
                "order": 20
            },
            {
                "name": "proxy",
                "short_flag": "-p",
                "long_flag": "--proxy",
                "description": "Proxy to use for requests",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "http://127.0.0.1:8080",
                "category": "connection",
                "order": 21
            },
            {
                "name": "cookies",
                "short_flag": "-c",
                "long_flag": "--cookies",
                "description": "Cookies to use for the requests",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "session=abc123",
                "category": "request",
                "order": 22
            },
            {
                "name": "useragent",
                "short_flag": "-a",
                "long_flag": "--useragent",
                "description": "User agent string",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "Mozilla/5.0",
                "category": "request",
                "order": 23
            },
            {
                "name": "headers",
                "short_flag": "-H",
                "long_flag": "--headers",
                "description": "Additional headers",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "Authorization: Bearer token123",
                "category": "request",
                "order": 24
            },
            {
                "name": "timeout",
                "short_flag": None,
                "long_flag": "--timeout",
                "description": "HTTP timeout (default: 10s)",
                "value_type": "string",
                "required": False,
                "default_value": "10s",
                "example_value": "30s",
                "category": "connection",
                "order": 25
            },
            {
                "name": "output",
                "short_flag": "-o",
                "long_flag": "--output",
                "description": "Output file to write results",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "results.txt",
                "category": "output",
                "order": 30
            },
            {
                "name": "verbose",
                "short_flag": "-v",
                "long_flag": "--verbose",
                "description": "Verbose output (show errors)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 31
            },
            {
                "name": "quiet",
                "short_flag": "-q",
                "long_flag": "--quiet",
                "description": "Quiet mode (no banner)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 32
            },
            {
                "name": "no_progress",
                "short_flag": "-z",
                "long_flag": "--no-progress",
                "description": "Don't display progress",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 33
            },
            {
                "name": "domain",
                "short_flag": "-d",
                "long_flag": "--domain",
                "description": "Target domain (for dns mode)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "example.com",
                "category": "dns_mode",
                "order": 40
            },
            {
                "name": "resolver",
                "short_flag": None,
                "long_flag": "--resolver",
                "description": "Custom DNS server",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "8.8.8.8",
                "category": "dns_mode",
                "order": 41
            },
            {
                "name": "show_ips",
                "short_flag": "-i",
                "long_flag": "--show-ips",
                "description": "Show IP addresses",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "dns_mode",
                "order": 42
            },
            {
                "name": "show_cname",
                "short_flag": None,
                "long_flag": "--show-cname",
                "description": "Show CNAME records",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "dns_mode",
                "order": 43
            },
            {
                "name": "wildcard",
                "short_flag": None,
                "long_flag": "--wildcard",
                "description": "Force wildcard processing",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "dns_mode",
                "order": 44
            },
            {
                "name": "delay",
                "short_flag": None,
                "long_flag": "--delay",
                "description": "Time to wait between requests",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "100ms",
                "category": "performance",
                "order": 50
            },
            {
                "name": "retry",
                "short_flag": None,
                "long_flag": "--retry",
                "description": "Number of retries on timeout",
                "value_type": "integer",
                "required": False,
                "default_value": 0,
                "example_value": "3",
                "category": "performance",
                "order": 51
            }
        ],
        "presets": [
            {
                "name": "Basic Directory Scan",
                "description": "Standard directory enumeration",
                "difficulty": "beginner",
                "category": "discovery",
                "parameters": {
                    "mode": "dir",
                    "wordlist": "/usr/share/wordlists/dirb/common.txt"
                }
            },
            {
                "name": "Fast Scan",
                "description": "High-speed directory scan",
                "difficulty": "intermediate",
                "category": "discovery",
                "parameters": {
                    "mode": "dir",
                    "threads": 100
                }
            },
            {
                "name": "PHP/Web Files",
                "description": "Scan for common web file extensions",
                "difficulty": "beginner",
                "category": "discovery",
                "parameters": {
                    "mode": "dir",
                    "extensions": "php,html,js,txt,bak"
                }
            },
            {
                "name": "DNS Subdomain",
                "description": "Enumerate DNS subdomains",
                "difficulty": "intermediate",
                "category": "dns",
                "parameters": {
                    "mode": "dns",
                    "show_ips": True
                }
            },
            {
                "name": "Virtual Host Discovery",
                "description": "Find virtual hosts",
                "difficulty": "intermediate",
                "category": "discovery",
                "parameters": {
                    "mode": "vhost"
                }
            }
        ],
        "examples": [
            {
                "title": "Basic Directory Scan",
                "command": "gobuster dir -u http://example.com -w /usr/share/wordlists/dirb/common.txt",
                "description": "Enumerate directories on target"
            },
            {
                "title": "With File Extensions",
                "command": "gobuster dir -u http://example.com -w wordlist.txt -x php,html,txt",
                "description": "Search for specific file types"
            },
            {
                "title": "DNS Subdomain Enumeration",
                "command": "gobuster dns -d example.com -w subdomains.txt",
                "description": "Find subdomains"
            },
            {
                "title": "Fast Scan with Threads",
                "command": "gobuster dir -u http://example.com -w wordlist.txt -t 100",
                "description": "High-speed scan with 100 threads"
            },
            {
                "title": "Virtual Host Discovery",
                "command": "gobuster vhost -u http://example.com -w vhosts.txt",
                "description": "Discover virtual hosts"
            },
            {
                "title": "With Authentication",
                "command": "gobuster dir -u http://example.com -w wordlist.txt -c 'session=abc123'",
                "description": "Scan with session cookie"
            }
        ],
        "related_tools": ["dirb", "dirbuster", "ffuf", "wfuzz", "feroxbuster"]
    },
    
    # ========================================
    # METASPLOIT - Penetration Testing Framework
    # ========================================
    "metasploit": {
        "name": "Metasploit Framework",
        "slug": "metasploit",
        "category": "Exploitation Tools",
        "subcategory": "Metasploit",
        "description": "World's most used penetration testing framework",
        "long_description": """The Metasploit Framework is the most commonly-used penetration testing framework in the world. It helps security professionals find vulnerabilities, verify vulnerability mitigations, and manage security assessments.

Metasploit provides the infrastructure, content, and tools to perform penetration tests and security assessments. It includes a database of over 2,000 exploits, 1,000 auxiliary modules, and 500+ payloads.

The framework supports multiple interfaces including msfconsole (interactive command-line), msfweb (web interface), Armitage (GUI), and can be scripted with Ruby.""",
        "author": "Rapid7",
        "version": "6.3",
        "license": "BSD-3-Clause",
        "homepage": "https://www.metasploit.com",
        "repository": "https://github.com/rapid7/metasploit-framework",
        "documentation_url": "https://docs.metasploit.com",
        "plan_required": "enterprise",
        "installation": "apt install metasploit-framework",
        "docker_image": "metasploitframework/metasploit-framework",
        "command_template": "msfconsole {options}",
        "tags": ["exploit", "pentest", "vulnerability", "framework", "hacking"],
        "parameters": [
            {
                "name": "quiet",
                "short_flag": "-q",
                "long_flag": "--quiet",
                "description": "Run in quiet mode (no banner)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "general",
                "order": 1
            },
            {
                "name": "resource",
                "short_flag": "-r",
                "long_flag": "--resource",
                "description": "Execute specified resource file",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "script.rc",
                "category": "automation",
                "order": 2
            },
            {
                "name": "execute_command",
                "short_flag": "-x",
                "long_flag": "--execute-command",
                "description": "Execute specified string as console commands",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "db_status; exit",
                "category": "automation",
                "order": 3
            },
            {
                "name": "environment",
                "short_flag": "-e",
                "long_flag": "--environment",
                "description": "Database environment to use",
                "value_type": "string",
                "required": False,
                "default_value": "production",
                "example_value": "development",
                "category": "database",
                "order": 4
            },
            {
                "name": "migration_path",
                "short_flag": "-m",
                "long_flag": "--migration-path",
                "description": "Path to database migration files",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "/path/to/migrations",
                "category": "database",
                "order": 5
            },
            {
                "name": "no_database",
                "short_flag": "-n",
                "long_flag": "--no-database",
                "description": "Disable database support",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "database",
                "order": 6
            },
            {
                "name": "plugin",
                "short_flag": "-p",
                "long_flag": "--plugin",
                "description": "Load a plugin on startup",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "nessus",
                "category": "plugins",
                "order": 7
            },
            {
                "name": "logger",
                "short_flag": "-L",
                "long_flag": "--logger",
                "description": "Specify logger to use",
                "value_type": "string",
                "required": False,
                "default_value": "TimestampColorlessFlatfile",
                "example_value": "Flatfile",
                "category": "logging",
                "order": 8
            },
            {
                "name": "log_level",
                "short_flag": "-l",
                "long_flag": "--log-level",
                "description": "Set log level (0-3)",
                "value_type": "integer",
                "required": False,
                "default_value": 0,
                "example_value": "3",
                "category": "logging",
                "order": 9
            }
        ],
        "presets": [
            {
                "name": "Quick Start",
                "description": "Start msfconsole quietly",
                "difficulty": "beginner",
                "category": "general",
                "parameters": {
                    "quiet": True
                }
            },
            {
                "name": "Run Script",
                "description": "Execute automation script",
                "difficulty": "intermediate",
                "category": "automation",
                "parameters": {
                    "quiet": True
                }
            }
        ],
        "examples": [
            {
                "title": "Start Console",
                "command": "msfconsole",
                "description": "Start Metasploit interactive console"
            },
            {
                "title": "Quiet Mode",
                "command": "msfconsole -q",
                "description": "Start without banner"
            },
            {
                "title": "Run Resource Script",
                "command": "msfconsole -r script.rc",
                "description": "Execute commands from file"
            },
            {
                "title": "Execute Commands",
                "command": "msfconsole -x 'use exploit/windows/smb/ms17_010_eternalblue; set RHOSTS 192.168.1.1; run'",
                "description": "Run specific exploit"
            },
            {
                "title": "Database Check",
                "command": "msfconsole -x 'db_status; exit'",
                "description": "Check database connection"
            }
        ],
        "related_tools": ["armitage", "cobalt-strike", "beef", "empire"]
    },
    
    # ========================================
    # JOHN THE RIPPER - Password Cracker
    # ========================================
    "john": {
        "name": "John the Ripper",
        "slug": "john",
        "category": "Password Attacks",
        "subcategory": "Offline Attacks",
        "description": "Fast password cracker for detecting weak passwords",
        "long_description": """John the Ripper is a fast password cracker, currently available for many flavors of Unix, macOS, Windows, DOS, BeOS, and OpenVMS (the latter requires a contributed patch). Its primary purpose is to detect weak Unix passwords.

Besides several crypt(3) password hash types most commonly found on various Unix flavors, supported out of the box are Kerberos/AFS and Windows LM hashes, as well as DES-based tripcodes, plus hundreds of additional hashes and ciphers in "-jumbo" versions.""",
        "author": "Solar Designer",
        "version": "1.9.0-jumbo-1",
        "license": "GPL-2.0",
        "homepage": "https://www.openwall.com/john/",
        "repository": "https://github.com/openwall/john",
        "documentation_url": "https://www.openwall.com/john/doc/",
        "plan_required": "professional",
        "installation": "apt install john",
        "docker_image": "phocean/john",
        "command_template": "john {options} {hashfile}",
        "tags": ["password", "cracking", "hash", "brute-force", "dictionary"],
        "parameters": [
            {
                "name": "hashfile",
                "short_flag": None,
                "long_flag": None,
                "description": "Password hash file to crack",
                "value_type": "file",
                "required": True,
                "default_value": None,
                "example_value": "hashes.txt",
                "category": "target",
                "order": 1
            },
            {
                "name": "wordlist",
                "short_flag": None,
                "long_flag": "--wordlist",
                "description": "Wordlist file for dictionary attack",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "/usr/share/wordlists/rockyou.txt",
                "category": "attack",
                "order": 2
            },
            {
                "name": "rules",
                "short_flag": None,
                "long_flag": "--rules",
                "description": "Enable word mangling rules",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "best64",
                "category": "attack",
                "order": 3
            },
            {
                "name": "format",
                "short_flag": None,
                "long_flag": "--format",
                "description": "Force hash type (e.g., raw-md5, nt, sha256crypt)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "raw-md5",
                "category": "hash",
                "order": 4
            },
            {
                "name": "incremental",
                "short_flag": None,
                "long_flag": "--incremental",
                "description": "Incremental (brute force) mode",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "Digits",
                "category": "attack",
                "order": 5
            },
            {
                "name": "single",
                "short_flag": None,
                "long_flag": "--single",
                "description": "Single crack mode using GECOS info",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "attack",
                "order": 6
            },
            {
                "name": "show",
                "short_flag": None,
                "long_flag": "--show",
                "description": "Show cracked passwords",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 10
            },
            {
                "name": "list_formats",
                "short_flag": None,
                "long_flag": "--list=formats",
                "description": "List supported hash formats",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "info",
                "order": 11
            },
            {
                "name": "pot",
                "short_flag": None,
                "long_flag": "--pot",
                "description": "Pot file to use",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "john.pot",
                "category": "output",
                "order": 12
            },
            {
                "name": "session",
                "short_flag": None,
                "long_flag": "--session",
                "description": "Session name for restoring",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "crack1",
                "category": "session",
                "order": 20
            },
            {
                "name": "restore",
                "short_flag": None,
                "long_flag": "--restore",
                "description": "Restore interrupted session",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "crack1",
                "category": "session",
                "order": 21
            },
            {
                "name": "fork",
                "short_flag": None,
                "long_flag": "--fork",
                "description": "Number of processes to fork",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "4",
                "category": "performance",
                "order": 30
            }
        ],
        "presets": [
            {
                "name": "Dictionary Attack",
                "description": "Basic wordlist attack",
                "difficulty": "beginner",
                "category": "attack",
                "parameters": {
                    "wordlist": "/usr/share/wordlists/rockyou.txt"
                }
            },
            {
                "name": "Dictionary with Rules",
                "description": "Wordlist with mangling rules",
                "difficulty": "intermediate",
                "category": "attack",
                "parameters": {
                    "wordlist": "/usr/share/wordlists/rockyou.txt",
                    "rules": "best64"
                }
            },
            {
                "name": "Brute Force",
                "description": "Incremental brute force attack",
                "difficulty": "advanced",
                "category": "attack",
                "parameters": {
                    "incremental": "All"
                }
            },
            {
                "name": "Show Cracked",
                "description": "Display cracked passwords",
                "difficulty": "beginner",
                "category": "output",
                "parameters": {
                    "show": True
                }
            }
        ],
        "examples": [
            {
                "title": "Basic Crack",
                "command": "john hashes.txt",
                "description": "Crack hashes using default modes"
            },
            {
                "title": "Dictionary Attack",
                "command": "john --wordlist=/usr/share/wordlists/rockyou.txt hashes.txt",
                "description": "Use wordlist for cracking"
            },
            {
                "title": "With Rules",
                "command": "john --wordlist=wordlist.txt --rules=best64 hashes.txt",
                "description": "Apply mangling rules"
            },
            {
                "title": "Specify Format",
                "command": "john --format=raw-md5 hashes.txt",
                "description": "Force MD5 hash format"
            },
            {
                "title": "Show Cracked",
                "command": "john --show hashes.txt",
                "description": "Display cracked passwords"
            },
            {
                "title": "Incremental Mode",
                "command": "john --incremental=Digits hashes.txt",
                "description": "Brute force digits only"
            }
        ],
        "related_tools": ["hashcat", "hydra", "ophcrack", "cain"]
    },
    
    # ========================================
    # WIRESHARK/TSHARK - Network Analyzer
    # ========================================
    "wireshark": {
        "name": "Wireshark",
        "slug": "wireshark",
        "category": "Sniffing & Spoofing",
        "subcategory": "Network Sniffers",
        "description": "World's foremost network protocol analyzer",
        "long_description": """Wireshark is the world's foremost and widely-used network protocol analyzer. It lets you see what's happening on your network at a microscopic level and is the de facto (and often de jure) standard across many commercial and non-profit enterprises, government agencies, and educational institutions.

Wireshark development thrives thanks to the volunteer contributions of networking experts around the globe and is the continuation of a project started by Gerald Combs in 1998.

Features include deep inspection of hundreds of protocols, live capture and offline analysis, standard three-pane packet browser, multi-platform support, captured network data can be browsed via a GUI or via the TTY-mode TShark utility.""",
        "author": "Gerald Combs, Wireshark Foundation",
        "version": "4.2",
        "license": "GPL-2.0",
        "homepage": "https://www.wireshark.org",
        "repository": "https://gitlab.com/wireshark/wireshark",
        "documentation_url": "https://www.wireshark.org/docs/",
        "plan_required": "starter",
        "installation": "apt install wireshark tshark",
        "docker_image": "linuxserver/wireshark",
        "command_template": "tshark {options}",
        "tags": ["network", "packet", "capture", "analysis", "protocol", "sniffer"],
        "parameters": [
            {
                "name": "interface",
                "short_flag": "-i",
                "long_flag": None,
                "description": "Network interface to capture from",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "eth0",
                "category": "capture",
                "order": 1
            },
            {
                "name": "capture_filter",
                "short_flag": "-f",
                "long_flag": None,
                "description": "Capture filter in BPF syntax",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "port 80",
                "category": "capture",
                "order": 2
            },
            {
                "name": "display_filter",
                "short_flag": "-Y",
                "long_flag": None,
                "description": "Display filter expression",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "http.request",
                "category": "display",
                "order": 3
            },
            {
                "name": "read_file",
                "short_flag": "-r",
                "long_flag": None,
                "description": "Read packets from file",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "capture.pcap",
                "category": "input",
                "order": 4
            },
            {
                "name": "write_file",
                "short_flag": "-w",
                "long_flag": None,
                "description": "Write packets to file",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "output.pcap",
                "category": "output",
                "order": 5
            },
            {
                "name": "count",
                "short_flag": "-c",
                "long_flag": None,
                "description": "Stop after n packets",
                "value_type": "integer",
                "required": False,
                "default_value": None,
                "example_value": "100",
                "category": "capture",
                "order": 6
            },
            {
                "name": "autostop_duration",
                "short_flag": "-a",
                "long_flag": None,
                "description": "Stop after duration (e.g., duration:60)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "duration:60",
                "category": "capture",
                "order": 7
            },
            {
                "name": "verbose",
                "short_flag": "-V",
                "long_flag": None,
                "description": "Print packet details (verbose)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 10
            },
            {
                "name": "print_hex",
                "short_flag": "-x",
                "long_flag": None,
                "description": "Print hex and ASCII dump of packet data",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 11
            },
            {
                "name": "fields",
                "short_flag": "-T",
                "long_flag": None,
                "description": "Output format (fields, json, pdml, psml, tabs, text)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "json",
                "category": "output",
                "order": 12
            },
            {
                "name": "extract_fields",
                "short_flag": "-e",
                "long_flag": None,
                "description": "Field to print (use with -T fields)",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "ip.src",
                "category": "output",
                "order": 13
            },
            {
                "name": "quiet",
                "short_flag": "-q",
                "long_flag": None,
                "description": "Quiet mode (less output)",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "output",
                "order": 14
            },
            {
                "name": "statistics",
                "short_flag": "-z",
                "long_flag": None,
                "description": "Statistics to calculate",
                "value_type": "string",
                "required": False,
                "default_value": None,
                "example_value": "io,stat,1",
                "category": "analysis",
                "order": 20
            },
            {
                "name": "list_interfaces",
                "short_flag": "-D",
                "long_flag": None,
                "description": "List available interfaces",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "info",
                "order": 30
            },
            {
                "name": "promiscuous_off",
                "short_flag": "-p",
                "long_flag": None,
                "description": "Don't capture in promiscuous mode",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "capture",
                "order": 31
            }
        ],
        "presets": [
            {
                "name": "HTTP Traffic",
                "description": "Capture HTTP requests and responses",
                "difficulty": "beginner",
                "category": "web",
                "parameters": {
                    "capture_filter": "port 80",
                    "display_filter": "http"
                }
            },
            {
                "name": "DNS Traffic",
                "description": "Capture DNS queries and responses",
                "difficulty": "beginner",
                "category": "network",
                "parameters": {
                    "capture_filter": "port 53",
                    "display_filter": "dns"
                }
            },
            {
                "name": "Full Capture",
                "description": "Capture all traffic on interface",
                "difficulty": "beginner",
                "category": "general",
                "parameters": {
                    "verbose": True
                }
            },
            {
                "name": "JSON Output",
                "description": "Output packets as JSON",
                "difficulty": "intermediate",
                "category": "output",
                "parameters": {
                    "fields": "json"
                }
            }
        ],
        "examples": [
            {
                "title": "Capture on Interface",
                "command": "tshark -i eth0",
                "description": "Capture packets on eth0"
            },
            {
                "title": "Capture HTTP",
                "command": "tshark -i eth0 -f 'port 80'",
                "description": "Capture HTTP traffic"
            },
            {
                "title": "Read PCAP",
                "command": "tshark -r capture.pcap",
                "description": "Read and display capture file"
            },
            {
                "title": "Filter Display",
                "command": "tshark -r capture.pcap -Y 'http.request'",
                "description": "Filter for HTTP requests"
            },
            {
                "title": "Save Capture",
                "command": "tshark -i eth0 -w output.pcap -c 1000",
                "description": "Capture 1000 packets to file"
            },
            {
                "title": "Extract Fields",
                "command": "tshark -r capture.pcap -T fields -e ip.src -e ip.dst",
                "description": "Extract source and destination IPs"
            },
            {
                "title": "JSON Output",
                "command": "tshark -r capture.pcap -T json",
                "description": "Output packets as JSON"
            }
        ],
        "related_tools": ["tcpdump", "ettercap", "bettercap", "dsniff"]
    },
    
    # ========================================
    # BURP SUITE - Web Security Testing
    # ========================================
    "burpsuite": {
        "name": "Burp Suite",
        "slug": "burpsuite",
        "category": "Web Applications",
        "subcategory": "Web Application Proxies",
        "description": "Leading web security testing platform",
        "long_description": """Burp Suite is an integrated platform for performing security testing of web applications. Its various tools work seamlessly together to support the entire testing process, from initial mapping and analysis of an application's attack surface, through to finding and exploiting security vulnerabilities.

Burp Suite Community Edition includes the essential manual tools for web security testing. It provides a proxy server to intercept browser traffic, a Spider to crawl web applications, a Repeater to manually manipulate and resend requests, and a Decoder for encoding/decoding data.

The Professional and Enterprise editions add advanced features like automated vulnerability scanning, session handling, and professional reporting.""",
        "author": "PortSwigger",
        "version": "2024.1",
        "license": "Proprietary (Community Edition is free)",
        "homepage": "https://portswigger.net/burp",
        "repository": None,
        "documentation_url": "https://portswigger.net/burp/documentation",
        "plan_required": "professional",
        "installation": "apt install burpsuite",
        "docker_image": None,
        "command_template": "burpsuite {options}",
        "tags": ["web", "proxy", "security", "testing", "vulnerability", "scanner"],
        "parameters": [
            {
                "name": "project_file",
                "short_flag": None,
                "long_flag": "--project-file",
                "description": "Open specified project file",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "project.burp",
                "category": "project",
                "order": 1
            },
            {
                "name": "config_file",
                "short_flag": None,
                "long_flag": "--config-file",
                "description": "Load configuration from file",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "config.json",
                "category": "config",
                "order": 2
            },
            {
                "name": "user_config_file",
                "short_flag": None,
                "long_flag": "--user-config-file",
                "description": "Load user configuration from file",
                "value_type": "file",
                "required": False,
                "default_value": None,
                "example_value": "user_config.json",
                "category": "config",
                "order": 3
            },
            {
                "name": "unpause_spider",
                "short_flag": None,
                "long_flag": "--unpause-spider-and-scanner",
                "description": "Unpause spider and scanner on startup",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "automation",
                "order": 4
            },
            {
                "name": "disable_extensions",
                "short_flag": None,
                "long_flag": "--disable-extensions",
                "description": "Disable all extensions",
                "value_type": "boolean",
                "required": False,
                "default_value": False,
                "example_value": None,
                "category": "extensions",
                "order": 5
            }
        ],
        "presets": [
            {
                "name": "Default Start",
                "description": "Start Burp with default settings",
                "difficulty": "beginner",
                "category": "general",
                "parameters": {}
            },
            {
                "name": "With Project",
                "description": "Open existing project",
                "difficulty": "beginner",
                "category": "project",
                "parameters": {}
            }
        ],
        "examples": [
            {
                "title": "Start Burp Suite",
                "command": "burpsuite",
                "description": "Launch Burp Suite GUI"
            },
            {
                "title": "Open Project",
                "command": "burpsuite --project-file=project.burp",
                "description": "Open specific project file"
            },
            {
                "title": "With Config",
                "command": "burpsuite --config-file=config.json",
                "description": "Start with configuration file"
            }
        ],
        "related_tools": ["zaproxy", "mitmproxy", "fiddler", "charles"]
    }
}

def get_additional_tools():
    """Get all additional tools"""
    return ADDITIONAL_TOOLS

def merge_all_tools(base_tools):
    """Merge base tools with additional tools"""
    merged = dict(base_tools)
    merged.update(ADDITIONAL_TOOLS)
    return merged
