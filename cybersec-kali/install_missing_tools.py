#!/usr/bin/env python3
"""
CyberSec Pro - Missing Tools Installer
Automatically installs missing security tools
"""
import subprocess
import sys
import os
import time
from pathlib import Path

class ToolInstaller:
    def __init__(self):
        self.installed_count = 0
        self.failed_count = 0
        self.skipped_count = 0
        
        # Tool installation methods
        self.installation_methods = {
            # APT packages (Ubuntu/Debian)
            'apt': [
                'crackmapexec', 'enum4linux', 'enum4linux-ng', 'volatility3',
                'ghidra', 'ida-free', 'cutter', 'radare2', 'gdb-peda',
                'exploitdb', 'searchsploit', 'metasploit-framework',
                'burpsuite', 'zaproxy', 'wireshark', 'tshark',
                'john', 'hashcat', 'hydra', 'medusa', 'ncrack',
                'aircrack-ng', 'reaver', 'pixiewps', 'bully',
                'binwalk', 'foremost', 'steghide', 'exiftool', 'strings',
                'ltrace', 'strace', 'objdump', 'hexdump',
                'nmap', 'masscan', 'unicornscan', 'zmap',
                'nikto', 'dirb', 'dirbuster', 'wfuzz',
                'sqlmap', 'bbqsql', 'nosqlmap',
                'nuclei', 'subfinder', 'httpx', 'ffuf', 'gobuster',
                'feroxbuster', 'amass', 'assetfinder', 'knockpy'
            ],
            
            # PIP packages
            'pip': [
                'volatility3', 'droopescan', 'arjun', 'xsser',
                'impacket', 'pwntools', 'ropper', 'ropgadget',
                'scoutsuite', 'pacu', 'awscli', 'azure-cli',
                'crackmapexec', 'bloodhound', 'neo4j',
                'sherlock-project', 'photon-crawler', 'osintgram',
                'theHarvester', 'spiderfoot', 'recon-ng',
                'xsstrike', 'dalfox', 'paramspider', 'hakrawler',
                'gospider', 'linkfinder', 'secretfinder',
                'sublist3r', 'dnsrecon', 'fierce', 'dnstwist',
                'urlcrazy', 'whatweb', 'wafw00f', 'cmseek'
            ],
            
            # PIPX packages (isolated environments)
            'pipx': [
                'crackmapexec', 'impacket', 'volatility3', 'bloodhound',
                'scoutsuite', 'pacu', 'nuclei-templates'
            ],
            
            # GO packages
            'go': [
                ('nuclei', 'github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest'),
                ('subfinder', 'github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest'),
                ('httpx', 'github.com/projectdiscovery/httpx/cmd/httpx@latest'),
                ('ffuf', 'github.com/ffuf/ffuf@latest'),
                ('gobuster', 'github.com/OJ/gobuster/v3@latest'),
                ('feroxbuster', 'github.com/epi052/feroxbuster@latest'),
                ('amass', 'github.com/owasp-amass/amass/v4/...@master'),
                ('assetfinder', 'github.com/tomnomnom/assetfinder@latest'),
                ('hakrawler', 'github.com/hakluke/hakrawler@latest'),
                ('gospider', 'github.com/jaeles-project/gospider@latest'),
                ('paramspider', 'github.com/devanshbatham/ParamSpider@latest'),
                ('gau', 'github.com/lc/gau/v2/cmd/gau@latest'),
                ('waybackurls', 'github.com/tomnomnom/waybackurls@latest')
            ],
            
            # GitHub releases (manual download)
            'github': [
                ('ghidra', 'https://github.com/NationalSecurityAgency/ghidra/releases'),
                ('burpsuite', 'https://portswigger.net/burp/communitydownload'),
                ('ida-free', 'https://hex-rays.com/ida-free/'),
                ('cutter', 'https://github.com/rizinorg/cutter/releases'),
                ('covenant', 'https://github.com/cobbr/Covenant'),
                ('sliver', 'https://github.com/BishopFox/sliver/releases'),
                ('havoc', 'https://github.com/HavocFramework/Havoc'),
                ('evilginx2', 'https://github.com/kgretzky/evilginx2'),
                ('modlishka', 'https://github.com/drk1wi/Modlishka')
            ]
        }

    def run_command(self, cmd, timeout=300):
        """Run command with timeout and error handling"""
        try:
            print(f"🔄 Running: {cmd}")
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True, 
                timeout=timeout, check=False
            )
            return result.returncode == 0, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            print(f"⏰ Command timed out: {cmd}")
            return False, "", "Timeout"
        except Exception as e:
            print(f"❌ Command failed: {cmd} - {e}")
            return False, "", str(e)

    def check_tool_installed(self, tool_name):
        """Check if tool is already installed"""
        # Try which command
        success, _, _ = self.run_command(f"which {tool_name}")
        if success:
            return True
        
        # Try pip show
        success, _, _ = self.run_command(f"pip show {tool_name}")
        if success:
            return True
        
        # Try dpkg
        success, _, _ = self.run_command(f"dpkg -l | grep -i {tool_name}")
        if success:
            return True
        
        return False

    def install_apt_packages(self):
        """Install tools via APT"""
        print("\n📦 Installing APT packages...")
        
        # Update package list
        print("🔄 Updating package lists...")
        success, _, _ = self.run_command("sudo apt update")
        if not success:
            print("⚠️  Failed to update package lists")
        
        for tool in self.installation_methods['apt']:
            if self.check_tool_installed(tool):
                print(f"✅ {tool} already installed")
                self.skipped_count += 1
                continue
            
            print(f"📦 Installing {tool}...")
            success, stdout, stderr = self.run_command(f"sudo apt install -y {tool}")
            
            if success:
                print(f"✅ {tool} installed successfully")
                self.installed_count += 1
            else:
                print(f"❌ Failed to install {tool}: {stderr[:100]}")
                self.failed_count += 1
            
            time.sleep(1)  # Rate limiting

    def install_pip_packages(self):
        """Install tools via PIP"""
        print("\n🐍 Installing PIP packages...")
        
        for tool in self.installation_methods['pip']:
            if self.check_tool_installed(tool):
                print(f"✅ {tool} already installed")
                self.skipped_count += 1
                continue
            
            print(f"🐍 Installing {tool}...")
            success, stdout, stderr = self.run_command(f"pip install {tool}")
            
            if success:
                print(f"✅ {tool} installed successfully")
                self.installed_count += 1
            else:
                print(f"❌ Failed to install {tool}: {stderr[:100]}")
                self.failed_count += 1
            
            time.sleep(1)

    def install_pipx_packages(self):
        """Install tools via PIPX (isolated environments)"""
        print("\n📦 Installing PIPX packages...")
        
        # Install pipx if not available
        if not self.check_tool_installed('pipx'):
            print("📦 Installing pipx...")
            success, _, _ = self.run_command("pip install pipx")
            if success:
                self.run_command("pipx ensurepath")
            else:
                print("❌ Failed to install pipx")
                return
        
        for tool in self.installation_methods['pipx']:
            if self.check_tool_installed(tool):
                print(f"✅ {tool} already installed")
                self.skipped_count += 1
                continue
            
            print(f"📦 Installing {tool} with pipx...")
            success, stdout, stderr = self.run_command(f"pipx install {tool}")
            
            if success:
                print(f"✅ {tool} installed successfully")
                self.installed_count += 1
            else:
                print(f"❌ Failed to install {tool}: {stderr[:100]}")
                self.failed_count += 1
            
            time.sleep(1)

    def install_go_packages(self):
        """Install tools via GO"""
        print("\n🔧 Installing GO packages...")
        
        # Check if Go is installed
        if not self.check_tool_installed('go'):
            print("📦 Installing Go...")
            success, _, _ = self.run_command("sudo apt install -y golang-go")
            if not success:
                print("❌ Failed to install Go")
                return
        
        for tool_name, package_url in self.installation_methods['go']:
            if self.check_tool_installed(tool_name):
                print(f"✅ {tool_name} already installed")
                self.skipped_count += 1
                continue
            
            print(f"🔧 Installing {tool_name}...")
            success, stdout, stderr = self.run_command(f"go install {package_url}")
            
            if success:
                print(f"✅ {tool_name} installed successfully")
                self.installed_count += 1
            else:
                print(f"❌ Failed to install {tool_name}: {stderr[:100]}")
                self.failed_count += 1
            
            time.sleep(1)

    def install_special_tools(self):
        """Install tools that need special handling"""
        print("\n🔧 Installing special tools...")
        
        # CrackMapExec (special case)
        if not self.check_tool_installed('crackmapexec'):
            print("🔧 Installing CrackMapExec...")
            commands = [
                "pip install crackmapexec",
                "pipx install crackmapexec",
                "sudo apt install -y crackmapexec"
            ]
            
            for cmd in commands:
                success, _, _ = self.run_command(cmd)
                if success:
                    print("✅ CrackMapExec installed successfully")
                    self.installed_count += 1
                    break
            else:
                print("❌ Failed to install CrackMapExec")
                self.failed_count += 1
        
        # Volatility3 (special case)
        if not self.check_tool_installed('volatility3'):
            print("🔧 Installing Volatility3...")
            success, _, _ = self.run_command("pip install volatility3")
            if success:
                print("✅ Volatility3 installed successfully")
                self.installed_count += 1
            else:
                print("❌ Failed to install Volatility3")
                self.failed_count += 1

    def fix_path_issues(self):
        """Fix PATH issues for installed tools"""
        print("\n🔧 Fixing PATH issues...")
        
        # Add ~/.local/bin to PATH if not already there
        bashrc_path = os.path.expanduser("~/.bashrc")
        local_bin_path = os.path.expanduser("~/.local/bin")
        
        if os.path.exists(local_bin_path):
            # Check if already in PATH
            current_path = os.environ.get('PATH', '')
            if local_bin_path not in current_path:
                print("🔧 Adding ~/.local/bin to PATH...")
                
                # Add to current session
                os.environ['PATH'] = f"{local_bin_path}:{current_path}"
                
                # Add to .bashrc for future sessions
                try:
                    with open(bashrc_path, 'a') as f:
                        f.write('\n# Added by CyberSec Pro tool installer\n')
                        f.write('export PATH="$HOME/.local/bin:$PATH"\n')
                    print("✅ PATH updated in ~/.bashrc")
                except Exception as e:
                    print(f"⚠️  Could not update ~/.bashrc: {e}")
        
        # Add Go bin to PATH
        go_bin_path = os.path.expanduser("~/go/bin")
        if os.path.exists(go_bin_path):
            current_path = os.environ.get('PATH', '')
            if go_bin_path not in current_path:
                print("🔧 Adding ~/go/bin to PATH...")
                os.environ['PATH'] = f"{go_bin_path}:{current_path}"
                
                try:
                    with open(bashrc_path, 'a') as f:
                        f.write('export PATH="$HOME/go/bin:$PATH"\n')
                    print("✅ Go PATH updated in ~/.bashrc")
                except Exception as e:
                    print(f"⚠️  Could not update ~/.bashrc: {e}")

    def install_all(self):
        """Install all missing tools"""
        print("🚀 CyberSec Pro - Missing Tools Installer")
        print("=" * 50)
        
        start_time = time.time()
        
        # Fix PATH issues first
        self.fix_path_issues()
        
        # Install tools by method
        self.install_special_tools()
        self.install_apt_packages()
        self.install_pip_packages()
        self.install_pipx_packages()
        self.install_go_packages()
        
        # Summary
        end_time = time.time()
        duration = int(end_time - start_time)
        
        print("\n" + "=" * 50)
        print("📊 INSTALLATION SUMMARY")
        print("=" * 50)
        print(f"✅ Installed: {self.installed_count}")
        print(f"⏭️  Skipped: {self.skipped_count}")
        print(f"❌ Failed: {self.failed_count}")
        print(f"⏱️  Duration: {duration}s")
        print("=" * 50)
        
        if self.installed_count > 0:
            print("\n🔄 Please restart your terminal or run:")
            print("source ~/.bashrc")
            print("\n🔄 Then restart the CyberSec Pro backend to detect new tools.")

def main():
    """Main function"""
    if os.geteuid() == 0:
        print("❌ Please don't run this script as root!")
        print("   The script will ask for sudo when needed.")
        sys.exit(1)
    
    installer = ToolInstaller()
    installer.install_all()

if __name__ == "__main__":
    main()