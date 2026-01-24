#!/usr/bin/env python3
"""
Advanced Tool Detection System for CyberSec Pro
Detects tools installed via various methods: apt, pip, pipx, manual installation, etc.
"""
import subprocess
import os
import sys
import importlib
from pathlib import Path
import json

class AdvancedToolDetector:
    def __init__(self):
        self.search_paths = [
            '/usr/bin',
            '/usr/local/bin', 
            '/opt',
            '/snap/bin',
            os.path.expanduser('~/.local/bin'),
            os.path.expanduser('~/bin'),
            '/usr/sbin',
            '/usr/local/sbin'
        ]
        
        # Special detection rules for specific tools
        self.special_detections = {
            'volatility': self._detect_volatility,
            'volatility3': self._detect_volatility3,
            'metasploit': self._detect_metasploit,
            'burpsuite': self._detect_burpsuite,
            'ghidra': self._detect_ghidra,
            'ida-free': self._detect_ida,
            'wireshark': self._detect_wireshark,
            'crackmapexec': self._detect_crackmapexec,
            'impacket': self._detect_impacket,
            'enum4linux': self._detect_enum4linux,
            'droopescan': self._detect_droopescan,
            'arjun': self._detect_arjun,
            'xsser': self._detect_xsser,
            'aws': self._detect_aws_cli,
            'nuclei': self._detect_nuclei,
            'subfinder': self._detect_subfinder,
            'httpx': self._detect_httpx,
            'ffuf': self._detect_ffuf,
            'gobuster': self._detect_gobuster,
            'feroxbuster': self._detect_feroxbuster,
            'wfuzz': self._detect_wfuzz,
            'dirb': self._detect_dirb,
            'dirbuster': self._detect_dirbuster,
            'nikto': self._detect_nikto,
            'sqlmap': self._detect_sqlmap,
            'nmap': self._detect_nmap,
            'masscan': self._detect_masscan,
            'zap': self._detect_zap,
            'john': self._detect_john,
            'hashcat': self._detect_hashcat,
            'hydra': self._detect_hydra,
            'medusa': self._detect_medusa,
            'aircrack-ng': self._detect_aircrack,
            'reaver': self._detect_reaver,
            'binwalk': self._detect_binwalk,
            'foremost': self._detect_foremost,
            'steghide': self._detect_steghide,
            'exiftool': self._detect_exiftool,
            'radare2': self._detect_radare2,
            'gdb': self._detect_gdb,
            'objdump': self._detect_objdump,
            'strings': self._detect_strings,
            'ltrace': self._detect_ltrace,
            'strace': self._detect_strace
        }

    def detect_tool(self, tool_name, command=None):
        """
        Detect if a tool is installed using multiple methods
        Returns: (is_installed: bool, version: str, path: str, method: str)
        """
        tool_name = tool_name.lower().strip()
        
        # Use special detection if available
        if tool_name in self.special_detections:
            return self.special_detections[tool_name]()
        
        # Try command if provided
        if command:
            cmd = command.split()[0] if ' ' in command else command
            if '{' not in cmd and '}' not in cmd:
                result = self._check_command(cmd)
                if result[0]:
                    return result
        
        # Try tool name variations
        variations = [
            tool_name,
            tool_name.replace(' ', '-'),
            tool_name.replace(' ', '_'),
            tool_name.replace('-', ''),
            tool_name.replace('_', ''),
            tool_name.lower()
        ]
        
        for variation in variations:
            result = self._check_command(variation)
            if result[0]:
                return result
        
        return False, None, None, None

    def _check_command(self, cmd):
        """Check if command exists using multiple methods"""
        # Method 1: which command
        try:
            result = subprocess.run(['which', cmd], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                path = result.stdout.strip()
                version = self._get_version(cmd)
                return True, version, path, 'which'
        except:
            pass
        
        # Method 2: whereis command  
        try:
            result = subprocess.run(['whereis', cmd], capture_output=True, text=True, timeout=5)
            if result.returncode == 0 and len(result.stdout.split()) > 1:
                path = result.stdout.split()[1] if len(result.stdout.split()) > 1 else None
                if path and os.path.exists(path):
                    version = self._get_version(cmd)
                    return True, version, path, 'whereis'
        except:
            pass
        
        # Method 3: Manual path search
        for search_path in self.search_paths:
            if os.path.exists(search_path):
                full_path = os.path.join(search_path, cmd)
                if os.path.exists(full_path) and os.access(full_path, os.X_OK):
                    version = self._get_version(cmd)
                    return True, version, full_path, 'manual_search'
        
        # Method 4: dpkg/apt check (for Debian/Ubuntu)
        try:
            result = subprocess.run(['dpkg', '-l', cmd], capture_output=True, text=True, timeout=5)
            if result.returncode == 0 and 'ii' in result.stdout:
                version = self._extract_dpkg_version(result.stdout)
                return True, version, f'/usr/bin/{cmd}', 'dpkg'
        except:
            pass
        
        # Method 5: pip/pipx check
        try:
            result = subprocess.run(['pip', 'show', cmd], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                version = self._extract_pip_version(result.stdout)
                return True, version, f'~/.local/bin/{cmd}', 'pip'
        except:
            pass
        
        return False, None, None, None

    def _get_version(self, cmd):
        """Try to get version of a command"""
        version_flags = ['--version', '-v', '-V', 'version', '--help']
        
        for flag in version_flags:
            try:
                result = subprocess.run([cmd, flag], capture_output=True, text=True, timeout=3)
                if result.returncode == 0 and result.stdout:
                    # Extract version number from output
                    lines = result.stdout.split('\n')[:3]  # First 3 lines usually contain version
                    for line in lines:
                        if any(word in line.lower() for word in ['version', 'v.', 'ver']):
                            return line.strip()[:50]  # Limit length
                    return lines[0].strip()[:50] if lines else None
            except:
                continue
        
        return None

    def _extract_dpkg_version(self, output):
        """Extract version from dpkg output"""
        try:
            lines = output.split('\n')
            for line in lines:
                if 'ii' in line:
                    parts = line.split()
                    if len(parts) >= 3:
                        return parts[2]
        except:
            pass
        return None

    def _extract_pip_version(self, output):
        """Extract version from pip show output"""
        try:
            for line in output.split('\n'):
                if line.startswith('Version:'):
                    return line.split(':', 1)[1].strip()
        except:
            pass
        return None

    # Special detection methods for specific tools
    def _detect_volatility(self):
        """Detect Volatility 2.x"""
        # Check for vol.py
        paths = ['/usr/bin/vol.py', '/opt/volatility/vol.py', '~/.local/bin/vol.py']
        for path in paths:
            expanded_path = os.path.expanduser(path)
            if os.path.exists(expanded_path):
                return True, "2.x", expanded_path, "manual"
        
        # Check Python import
        try:
            import volatility
            return True, "2.x (Python module)", "python", "import"
        except ImportError:
            pass
        
        return False, None, None, None

    def _detect_volatility3(self):
        """Detect Volatility 3.x"""
        # Check command
        result = self._check_command('volatility3')
        if result[0]:
            return result
        
        result = self._check_command('vol3')
        if result[0]:
            return result
        
        # Check Python import
        try:
            import volatility3
            return True, "3.x (Python module)", "python", "import"
        except ImportError:
            pass
        
        return False, None, None, None

    def _detect_metasploit(self):
        """Detect Metasploit Framework"""
        commands = ['msfconsole', 'msfvenom', 'msfdb']
        for cmd in commands:
            result = self._check_command(cmd)
            if result[0]:
                return result
        
        # Check for framework directory
        msf_paths = ['/opt/metasploit-framework', '/usr/share/metasploit-framework']
        for path in msf_paths:
            if os.path.exists(path):
                return True, "Framework", path, "directory"
        
        return False, None, None, None

    def _detect_burpsuite(self):
        """Detect Burp Suite"""
        # Check for burpsuite command
        result = self._check_command('burpsuite')
        if result[0]:
            return result
        
        # Check for jar file
        burp_paths = [
            '/opt/BurpSuiteCommunity/BurpSuiteCommunity.jar',
            '/opt/burpsuite/burpsuite.jar',
            '~/BurpSuiteCommunity.jar'
        ]
        for path in burp_paths:
            expanded_path = os.path.expanduser(path)
            if os.path.exists(expanded_path):
                return True, "Community/Pro", expanded_path, "jar"
        
        return False, None, None, None

    def _detect_ghidra(self):
        """Detect Ghidra"""
        result = self._check_command('ghidra')
        if result[0]:
            return result
        
        # Check for Ghidra directory
        ghidra_paths = ['/opt/ghidra', '~/ghidra*', '/usr/local/ghidra']
        for path in ghidra_paths:
            expanded_path = os.path.expanduser(path)
            if '*' in expanded_path:
                import glob
                matches = glob.glob(expanded_path)
                if matches and os.path.exists(matches[0]):
                    return True, "NSA Tool", matches[0], "directory"
            elif os.path.exists(expanded_path):
                return True, "NSA Tool", expanded_path, "directory"
        
        return False, None, None, None

    def _detect_ida(self):
        """Detect IDA Free/Pro"""
        commands = ['ida', 'ida64', 'idaq', 'idaq64']
        for cmd in commands:
            result = self._check_command(cmd)
            if result[0]:
                return result
        
        return False, None, None, None

    def _detect_wireshark(self):
        """Detect Wireshark"""
        commands = ['wireshark', 'tshark', 'dumpcap']
        for cmd in commands:
            result = self._check_command(cmd)
            if result[0]:
                return result
        
        return False, None, None, None

    def _detect_crackmapexec(self):
        """Detect CrackMapExec / NetExec"""
        # Check for new NetExec first
        commands = ['netexec', 'nxc']
        for cmd in commands:
            result = self._check_command(cmd)
            if result[0]:
                return result
        
        # Check for old CrackMapExec
        commands = ['crackmapexec', 'cme']
        for cmd in commands:
            result = self._check_command(cmd)
            if result[0]:
                return result
        
        # Check pipx installation
        pipx_path = os.path.expanduser('~/.local/bin/netexec')
        if os.path.exists(pipx_path):
            return True, "NetExec (pipx)", pipx_path, "pipx"
        
        pipx_path = os.path.expanduser('~/.local/bin/crackmapexec')
        if os.path.exists(pipx_path):
            return True, "pipx", pipx_path, "pipx"
        
        return False, None, None, None

    def _detect_impacket(self):
        """Detect Impacket tools"""
        impacket_tools = [
            'impacket-psexec', 'impacket-smbexec', 'impacket-wmiexec',
            'impacket-secretsdump', 'impacket-mimikatz', 'psexec.py',
            'smbexec.py', 'wmiexec.py', 'secretsdump.py'
        ]
        
        for tool in impacket_tools:
            result = self._check_command(tool)
            if result[0]:
                return result
        
        # Check Python import
        try:
            import impacket
            return True, "Python library", "python", "import"
        except ImportError:
            pass
        
        return False, None, None, None

    def _detect_enum4linux(self):
        """Detect enum4linux"""
        result = self._check_command('enum4linux')
        if result[0]:
            return result
        
        result = self._check_command('enum4linux-ng')
        if result[0]:
            return result
        
        return False, None, None, None

    def _detect_droopescan(self):
        """Detect droopescan"""
        result = self._check_command('droopescan')
        if result[0]:
            return result
        
        # Check ~/.local/bin
        local_path = os.path.expanduser('~/.local/bin/droopescan')
        if os.path.exists(local_path):
            return True, "pip", local_path, "pip"
        
        return False, None, None, None

    def _detect_arjun(self):
        """Detect Arjun"""
        result = self._check_command('arjun')
        if result[0]:
            return result
        
        # Check ~/.local/bin
        local_path = os.path.expanduser('~/.local/bin/arjun')
        if os.path.exists(local_path):
            return True, "pip", local_path, "pip"
        
        return False, None, None, None

    def _detect_xsser(self):
        """Detect XSSer"""
        result = self._check_command('xsser')
        if result[0]:
            return result
        
        # Check ~/.local/bin
        local_path = os.path.expanduser('~/.local/bin/xsser')
        if os.path.exists(local_path):
            return True, "pip", local_path, "pip"
        
        return False, None, None, None

    def _detect_aws_cli(self):
        """Detect AWS CLI"""
        result = self._check_command('aws')
        if result[0]:
            return result
        
        # Check ~/.local/bin
        local_path = os.path.expanduser('~/.local/bin/aws')
        if os.path.exists(local_path):
            return True, "pip", local_path, "pip"
        
        return False, None, None, None

    def _detect_nuclei(self):
        """Detect Nuclei"""
        return self._check_command('nuclei')

    def _detect_subfinder(self):
        """Detect Subfinder"""
        return self._check_command('subfinder')

    def _detect_httpx(self):
        """Detect httpx"""
        return self._check_command('httpx')

    def _detect_ffuf(self):
        """Detect ffuf"""
        return self._check_command('ffuf')

    def _detect_gobuster(self):
        """Detect gobuster"""
        return self._check_command('gobuster')

    def _detect_feroxbuster(self):
        """Detect feroxbuster"""
        return self._check_command('feroxbuster')

    def _detect_wfuzz(self):
        """Detect wfuzz"""
        return self._check_command('wfuzz')

    def _detect_dirb(self):
        """Detect dirb"""
        return self._check_command('dirb')

    def _detect_dirbuster(self):
        """Detect DirBuster"""
        result = self._check_command('dirbuster')
        if result[0]:
            return result
        
        # Check for jar file
        jar_paths = ['/usr/share/dirbuster/DirBuster.jar', '/opt/dirbuster/DirBuster.jar']
        for path in jar_paths:
            if os.path.exists(path):
                return True, "GUI Tool", path, "jar"
        
        return False, None, None, None

    def _detect_nikto(self):
        """Detect Nikto"""
        return self._check_command('nikto')

    def _detect_sqlmap(self):
        """Detect SQLMap"""
        return self._check_command('sqlmap')

    def _detect_nmap(self):
        """Detect Nmap"""
        return self._check_command('nmap')

    def _detect_masscan(self):
        """Detect Masscan"""
        return self._check_command('masscan')

    def _detect_zap(self):
        """Detect OWASP ZAP"""
        commands = ['zaproxy', 'zap.sh', 'zap']
        for cmd in commands:
            result = self._check_command(cmd)
            if result[0]:
                return result
        
        return False, None, None, None

    def _detect_john(self):
        """Detect John the Ripper"""
        commands = ['john', 'john-the-ripper']
        for cmd in commands:
            result = self._check_command(cmd)
            if result[0]:
                return result
        
        return False, None, None, None

    def _detect_hashcat(self):
        """Detect Hashcat"""
        return self._check_command('hashcat')

    def _detect_hydra(self):
        """Detect THC Hydra"""
        return self._check_command('hydra')

    def _detect_medusa(self):
        """Detect Medusa"""
        return self._check_command('medusa')

    def _detect_aircrack(self):
        """Detect Aircrack-ng suite"""
        commands = ['aircrack-ng', 'airodump-ng', 'aireplay-ng', 'airmon-ng']
        for cmd in commands:
            result = self._check_command(cmd)
            if result[0]:
                return result
        
        return False, None, None, None

    def _detect_reaver(self):
        """Detect Reaver"""
        return self._check_command('reaver')

    def _detect_binwalk(self):
        """Detect Binwalk"""
        return self._check_command('binwalk')

    def _detect_foremost(self):
        """Detect Foremost"""
        return self._check_command('foremost')

    def _detect_steghide(self):
        """Detect Steghide"""
        return self._check_command('steghide')

    def _detect_exiftool(self):
        """Detect ExifTool"""
        return self._check_command('exiftool')

    def _detect_radare2(self):
        """Detect Radare2"""
        commands = ['radare2', 'r2', 'rabin2', 'rasm2']
        for cmd in commands:
            result = self._check_command(cmd)
            if result[0]:
                return result
        
        return False, None, None, None

    def _detect_gdb(self):
        """Detect GDB"""
        return self._check_command('gdb')

    def _detect_objdump(self):
        """Detect objdump"""
        return self._check_command('objdump')

    def _detect_strings(self):
        """Detect strings"""
        return self._check_command('strings')

    def _detect_ltrace(self):
        """Detect ltrace"""
        return self._check_command('ltrace')

    def _detect_strace(self):
        """Detect strace"""
        return self._check_command('strace')


def main():
    """Test the detector"""
    detector = AdvancedToolDetector()
    
    test_tools = [
        'nmap', 'nikto', 'sqlmap', 'volatility3', 'droopescan', 
        'arjun', 'xsser', 'crackmapexec', 'impacket', 'enum4linux',
        'metasploit', 'burpsuite', 'wireshark', 'john', 'hashcat'
    ]
    
    print("🔍 Advanced Tool Detection Results:")
    print("=" * 60)
    
    for tool in test_tools:
        is_installed, version, path, method = detector.detect_tool(tool)
        status = "✅ INSTALLED" if is_installed else "❌ NOT FOUND"
        print(f"{tool:15} | {status:12} | {version or 'N/A':20} | {method or 'N/A'}")
    
    print("=" * 60)

if __name__ == "__main__":
    main()