#!/usr/bin/env python3
"""
Enhanced Tools Database - Detaylı açıklamalar ve donanım gereksinimleri
"""

ENHANCED_TOOLS = [
    # Information Gathering
    {
        'name': 'Nmap',
        'category': 'Information Gathering',
        'description': 'Network exploration and security auditing tool. Discovers hosts, services, operating systems, and vulnerabilities.',
        'command': 'nmap',
        'installed': True,
        'difficulty': 'beginner',
        'hardware_required': False,
        'usage': 'Port scanning, network discovery, OS detection, vulnerability scanning',
        'example': 'nmap -sS -O target.com'
    },
    {
        'name': 'Masscan',
        'category': 'Information Gathering', 
        'description': 'High-speed port scanner capable of scanning the entire Internet in under 6 minutes.',
        'command': 'masscan',
        'installed': True,
        'difficulty': 'intermediate',
        'hardware_required': False,
        'usage': 'Fast port scanning, large network discovery',
        'example': 'masscan -p1-65535 10.0.0.0/8 --rate=1000'
    },
    {
        'name': 'Unicornscan',
        'category': 'Information Gathering',
        'description': 'Asynchronous network stimulus delivery/response framework for information gathering.',
        'command': 'unicornscan',
        'installed': False,
        'difficulty': 'advanced',
        'hardware_required': False,
        'usage': 'Advanced port scanning, OS fingerprinting',
        'example': 'unicornscan -mT target.com:1-1000'
    },
    {
        'name': 'Zmap',
        'category': 'Information Gathering',
        'description': 'Fast single packet network scanner designed for Internet-wide network surveys.',
        'command': 'zmap',
        'installed': False,
        'difficulty': 'advanced',
        'hardware_required': False,
        'usage': 'Internet-wide scanning, research surveys',
        'example': 'zmap -p 80 -o results.csv'
    },
    {
        'name': 'Rustscan',
        'category': 'Information Gathering',
        'description': 'Modern port scanner built in Rust. Faster than Nmap with modern features.',
        'command': 'rustscan',
        'installed': False,
        'difficulty': 'beginner',
        'hardware_required': False,
        'usage': 'Fast port scanning, modern alternative to Nmap',
        'example': 'rustscan -a target.com -- -A'
    },
    
    # Web Applications
    {
        'name': 'Nikto',
        'category': 'Web Applications',
        'description': 'Web server scanner that tests for dangerous files, outdated software, and server configuration issues.',
        'command': 'nikto',
        'installed': True,
        'difficulty': 'beginner',
        'hardware_required': False,
        'usage': 'Web server vulnerability scanning, configuration testing',
        'example': 'nikto -h https://target.com'
    },
    {
        'name': 'Dirb',
        'category': 'Web Applications',
        'description': 'Web content scanner that looks for existing and hidden web objects.',
        'command': 'dirb',
        'installed': True,
        'difficulty': 'beginner',
        'hardware_required': False,
        'usage': 'Directory brute forcing, hidden content discovery',
        'example': 'dirb https://target.com /usr/share/dirb/wordlists/common.txt'
    },
    {
        'name': 'Gobuster',
        'category': 'Web Applications',
        'description': 'Fast directory/file brute forcer written in Go.',
        'command': 'gobuster',
        'installed': True,
        'difficulty': 'beginner',
        'hardware_required': False,
        'usage': 'Directory brute forcing, DNS subdomain enumeration',
        'example': 'gobuster dir -u https://target.com -w /usr/share/wordlists/dirb/common.txt'
    },
    {
        'name': 'FFuF',
        'category': 'Web Applications',
        'description': 'Fast web fuzzer written in Go. Highly customizable for various fuzzing tasks.',
        'command': 'ffuf',
        'installed': True,
        'difficulty': 'beginner',
        'hardware_required': False,
        'usage': 'Web fuzzing, parameter discovery, content discovery',
        'example': 'ffuf -w wordlist.txt -u https://target.com/FUZZ'
    },
    {
        'name': 'Burp Suite',
        'category': 'Web Applications',
        'description': 'Integrated platform for web application security testing with proxy, scanner, and various tools.',
        'command': 'burpsuite',
        'installed': True,
        'difficulty': 'intermediate',
        'hardware_required': False,
        'usage': 'Web application testing, proxy interception, vulnerability scanning',
        'example': 'GUI-based tool - Launch from applications menu'
    },
    
    # Database Assessment
    {
        'name': 'SQLMap',
        'category': 'Database Assessment',
        'description': 'Automatic SQL injection and database takeover tool.',
        'command': 'sqlmap',
        'installed': True,
        'difficulty': 'intermediate',
        'hardware_required': False,
        'usage': 'SQL injection testing, database enumeration, data extraction',
        'example': 'sqlmap -u "http://target.com/page.php?id=1" --dbs'
    },
    
    # Exploitation Tools
    {
        'name': 'Metasploit',
        'category': 'Exploitation Tools',
        'description': 'Advanced penetration testing framework with exploits, payloads, and post-exploitation modules.',
        'command': 'msfconsole',
        'installed': True,
        'difficulty': 'advanced',
        'hardware_required': False,
        'usage': 'Exploit development, penetration testing, post-exploitation',
        'example': 'msfconsole -> use exploit/windows/smb/ms17_010_eternalblue'
    },
    {
        'name': 'Impacket',
        'category': 'Exploitation Tools',
        'description': 'Collection of Python classes for working with network protocols (SMB, MSRPC, etc.).',
        'command': 'impacket-psexec',
        'installed': True,
        'difficulty': 'advanced',
        'hardware_required': False,
        'usage': 'Windows network protocol exploitation, lateral movement',
        'example': 'impacket-psexec domain/user:password@target.com'
    },
    
    # Password Attacks
    {
        'name': 'John',
        'category': 'Password Attacks',
        'description': 'Fast password cracker supporting many hash types and attack modes.',
        'command': 'john',
        'installed': True,
        'difficulty': 'intermediate',
        'hardware_required': False,
        'usage': 'Password cracking, hash analysis, dictionary attacks',
        'example': 'john --wordlist=/usr/share/wordlists/rockyou.txt hashes.txt'
    },
    {
        'name': 'Hashcat',
        'category': 'Password Attacks',
        'description': 'Advanced password recovery tool supporting GPU acceleration.',
        'command': 'hashcat',
        'installed': True,
        'difficulty': 'intermediate',
        'hardware_required': 'GPU recommended (NVIDIA/AMD)',
        'hardware_details': 'NVIDIA GTX 1060+ or AMD RX 580+ for optimal performance',
        'usage': 'GPU-accelerated password cracking, advanced hash attacks',
        'example': 'hashcat -m 0 -a 0 hashes.txt wordlist.txt'
    },
    {
        'name': 'Hydra',
        'category': 'Password Attacks',
        'description': 'Fast network logon cracker supporting many protocols.',
        'command': 'hydra',
        'installed': True,
        'difficulty': 'intermediate',
        'hardware_required': False,
        'usage': 'Network service brute forcing, protocol attacks',
        'example': 'hydra -l admin -P passwords.txt ssh://target.com'
    },
    
    # Wireless Attacks
    {
        'name': 'Aircrack-ng',
        'category': 'Wireless Attacks',
        'description': 'Complete suite of tools to assess WiFi network security.',
        'command': 'aircrack-ng',
        'installed': True,
        'difficulty': 'intermediate',
        'hardware_required': 'WiFi adapter with monitor mode',
        'hardware_details': 'Alfa AWUS036ACS, TP-Link AC600 T2U Plus, or similar',
        'usage': 'WiFi security testing, WEP/WPA cracking, packet capture',
        'example': 'aircrack-ng -w wordlist.txt capture.cap'
    },
    {
        'name': 'Reaver',
        'category': 'Wireless Attacks',
        'description': 'WPS brute force attack tool to recover WPA/WPA2 passphrases.',
        'command': 'reaver',
        'installed': True,
        'difficulty': 'intermediate',
        'hardware_required': 'WiFi adapter with monitor mode',
        'hardware_details': 'Same as Aircrack-ng - monitor mode capable adapter',
        'usage': 'WPS PIN brute forcing, WiFi password recovery',
        'example': 'reaver -i wlan0mon -b AA:BB:CC:DD:EE:FF -vv'
    },
    {
        'name': 'Proxmark3',
        'category': 'Hardware Hacking',
        'description': 'RFID/NFC research and penetration testing tool.',
        'command': 'proxmark3',
        'installed': False,
        'difficulty': 'advanced',
        'hardware_required': 'Proxmark3 device',
        'hardware_details': 'Proxmark3 RDV4.0, Proxmark3 Easy, or compatible clone',
        'usage': 'RFID/NFC security testing, card cloning, protocol analysis',
        'example': 'Requires physical Proxmark3 hardware device'
    },
    
    # Forensics
    {
        'name': 'Volatility3',
        'category': 'Forensics',
        'description': 'Advanced memory forensics framework for incident response and malware analysis.',
        'command': 'volatility3',
        'installed': True,
        'difficulty': 'advanced',
        'hardware_required': False,
        'usage': 'Memory dump analysis, malware detection, incident response',
        'example': 'volatility3 -f memory.dmp windows.info'
    },
    {
        'name': 'Binwalk',
        'category': 'Forensics',
        'description': 'Firmware analysis tool for searching and extracting embedded files.',
        'command': 'binwalk',
        'installed': True,
        'difficulty': 'intermediate',
        'hardware_required': False,
        'usage': 'Firmware analysis, embedded file extraction, IoT security',
        'example': 'binwalk -e firmware.bin'
    },
    {
        'name': 'Foremost',
        'category': 'Forensics',
        'description': 'File carving tool for recovering files from disk images.',
        'command': 'foremost',
        'installed': True,
        'difficulty': 'beginner',
        'hardware_required': False,
        'usage': 'File recovery, digital forensics, data carving',
        'example': 'foremost -i disk.img -o output/'
    },
    
    # Reverse Engineering
    {
        'name': 'Radare2',
        'category': 'Reverse Engineering',
        'description': 'Portable reverse engineering framework with disassembler, debugger, and analysis tools.',
        'command': 'radare2',
        'installed': True,
        'difficulty': 'advanced',
        'hardware_required': False,
        'usage': 'Binary analysis, reverse engineering, malware analysis',
        'example': 'r2 -A binary_file'
    },
    {
        'name': 'Ghidra',
        'category': 'Reverse Engineering',
        'description': 'NSA-developed software reverse engineering framework with advanced analysis capabilities.',
        'command': 'ghidra',
        'installed': True,
        'difficulty': 'expert',
        'hardware_required': False,
        'usage': 'Advanced reverse engineering, malware analysis, vulnerability research',
        'example': 'GUI-based tool - Launch from applications menu'
    },
    {
        'name': 'GDB',
        'category': 'Reverse Engineering',
        'description': 'GNU Debugger for debugging programs and analyzing runtime behavior.',
        'command': 'gdb',
        'installed': True,
        'difficulty': 'advanced',
        'hardware_required': False,
        'usage': 'Program debugging, exploit development, runtime analysis',
        'example': 'gdb ./program'
    },
    
    # Sniffing & Spoofing
    {
        'name': 'Wireshark',
        'category': 'Sniffing & Spoofing',
        'description': 'Network protocol analyzer for troubleshooting, analysis, and security auditing.',
        'command': 'wireshark',
        'installed': True,
        'difficulty': 'intermediate',
        'hardware_required': False,
        'usage': 'Network traffic analysis, protocol debugging, security monitoring',
        'example': 'GUI-based tool - Launch from applications menu'
    },
    {
        'name': 'Tcpdump',
        'category': 'Sniffing & Spoofing',
        'description': 'Command-line packet analyzer for network traffic capture and analysis.',
        'command': 'tcpdump',
        'installed': True,
        'difficulty': 'intermediate',
        'hardware_required': False,
        'usage': 'Network packet capture, traffic monitoring, protocol analysis',
        'example': 'tcpdump -i eth0 -w capture.pcap'
    },
    
    # Vulnerability Analysis
    {
        'name': 'Nuclei',
        'category': 'Vulnerability Analysis',
        'description': 'Fast vulnerability scanner based on simple YAML templates.',
        'command': 'nuclei',
        'installed': True,
        'difficulty': 'beginner',
        'hardware_required': False,
        'usage': 'Automated vulnerability scanning, security testing',
        'example': 'nuclei -u https://target.com -t /path/to/templates/'
    }
]

def get_enhanced_tool_info(tool_name):
    """Get enhanced information for a specific tool"""
    for tool in ENHANCED_TOOLS:
        if tool['name'].lower() == tool_name.lower():
            return tool
    return None

def update_tools_with_enhanced_info():
    """Update existing tools with enhanced information"""
    from flask import Flask
    from models import db, Tool
    from config import Config
    
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        updated = 0
        for enhanced_tool in ENHANCED_TOOLS:
            tool = Tool.query.filter_by(name=enhanced_tool['name']).first()
            if tool:
                # Update with enhanced info
                tool.description = enhanced_tool['description']
                tool.difficulty = enhanced_tool['difficulty']
                
                # Add new fields if they exist in the model
                if hasattr(tool, 'hardware_required'):
                    tool.hardware_required = enhanced_tool.get('hardware_required', False)
                if hasattr(tool, 'hardware_details'):
                    tool.hardware_details = enhanced_tool.get('hardware_details', '')
                if hasattr(tool, 'usage'):
                    tool.usage = enhanced_tool.get('usage', '')
                if hasattr(tool, 'example'):
                    tool.example = enhanced_tool.get('example', '')
                
                updated += 1
        
        db.session.commit()
        print(f"✅ Updated {updated} tools with enhanced information")
        return updated

if __name__ == "__main__":
    update_tools_with_enhanced_info()