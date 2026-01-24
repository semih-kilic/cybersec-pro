#!/usr/bin/env python3
"""
CyberSec Pro - Smart Missing Tools Installer
Handles Ubuntu 24.04 externally-managed-environment restrictions
"""
import subprocess
import sys
import os
import time
from pathlib import Path

class SmartToolInstaller:
    def __init__(self):
        self.installed_count = 0
        self.failed_count = 0
        self.skipped_count = 0
        
        # Priority tools that are most commonly needed
        self.priority_tools = [
            'crackmapexec', 'enum4linux', 'volatility3', 'droopescan',
            'arjun', 'xsser', 'impacket', 'nuclei', 'subfinder', 'httpx',
            'ffuf', 'gobuster', 'feroxbuster', 'assetfinder', 'hakrawler',
            'gospider', 'paramspider', 'sherlock', 'photon', 'dalfox',
            'xsstrike', 'pacu', 'scoutsuite', 'bloodhound'
        ]

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
        
        # Try ~/.local/bin
        local_path = os.path.expanduser(f"~/.local/bin/{tool_name}")
        if os.path.exists(local_path):
            return True
        
        # Try ~/go/bin
        go_path = os.path.expanduser(f"~/go/bin/{tool_name}")
        if os.path.exists(go_path):
            return True
        
        return False

    def install_with_pipx(self, tool_name, package_name=None):
        """Install tool using pipx (isolated environment)"""
        if package_name is None:
            package_name = tool_name
        
        print(f"📦 Installing {tool_name} with pipx...")
        success, stdout, stderr = self.run_command(f"pipx install {package_name}")
        
        if success:
            print(f"✅ {tool_name} installed successfully with pipx")
            self.installed_count += 1
            return True
        else:
            print(f"❌ Failed to install {tool_name} with pipx: {stderr[:100]}")
            return False

    def install_with_pip_user(self, tool_name, package_name=None):
        """Install tool using pip --user (user-local installation)"""
        if package_name is None:
            package_name = tool_name
        
        print(f"🐍 Installing {tool_name} with pip --user...")
        success, stdout, stderr = self.run_command(f"pip install --user {package_name}")
        
        if success:
            print(f"✅ {tool_name} installed successfully with pip --user")
            self.installed_count += 1
            return True
        else:
            print(f"❌ Failed to install {tool_name} with pip --user: {stderr[:100]}")
            return False

    def install_with_apt(self, tool_name, package_name=None):
        """Install tool using apt"""
        if package_name is None:
            package_name = tool_name
        
        print(f"📦 Installing {tool_name} with apt...")
        success, stdout, stderr = self.run_command(f"sudo apt install -y {package_name}")
        
        if success:
            print(f"✅ {tool_name} installed successfully with apt")
            self.installed_count += 1
            return True
        else:
            print(f"❌ Failed to install {tool_name} with apt: {stderr[:100]}")
            return False

    def install_with_go(self, tool_name, package_url):
        """Install tool using go install"""
        print(f"🔧 Installing {tool_name} with go...")
        success, stdout, stderr = self.run_command(f"go install {package_url}")
        
        if success:
            print(f"✅ {tool_name} installed successfully with go")
            self.installed_count += 1
            return True
        else:
            print(f"❌ Failed to install {tool_name} with go: {stderr[:100]}")
            return False

    def install_from_github(self, tool_name, repo_url, install_script=None):
        """Install tool from GitHub"""
        print(f"🔧 Installing {tool_name} from GitHub...")
        
        # Clone repository
        temp_dir = f"/tmp/{tool_name}_install"
        success, _, _ = self.run_command(f"rm -rf {temp_dir}")
        success, stdout, stderr = self.run_command(f"git clone {repo_url} {temp_dir}")
        
        if not success:
            print(f"❌ Failed to clone {repo_url}")
            return False
        
        # Run installation script if provided
        if install_script:
            success, stdout, stderr = self.run_command(f"cd {temp_dir} && {install_script}")
            if success:
                print(f"✅ {tool_name} installed successfully from GitHub")
                self.installed_count += 1
                return True
            else:
                print(f"❌ Failed to install {tool_name} from GitHub: {stderr[:100]}")
                return False
        
        return True

    def setup_prerequisites(self):
        """Setup prerequisites like pipx, go, etc."""
        print("🔧 Setting up prerequisites...")
        
        # Install pipx if not available
        if not self.check_tool_installed('pipx'):
            print("📦 Installing pipx...")
            success, _, _ = self.run_command("sudo apt install -y pipx")
            if success:
                self.run_command("pipx ensurepath")
                print("✅ pipx installed")
            else:
                print("❌ Failed to install pipx")
        
        # Install Go if not available
        if not self.check_tool_installed('go'):
            print("📦 Installing Go...")
            success, _, _ = self.run_command("sudo apt install -y golang-go")
            if success:
                print("✅ Go installed")
            else:
                print("❌ Failed to install Go")
        
        # Install git if not available
        if not self.check_tool_installed('git'):
            print("📦 Installing Git...")
            success, _, _ = self.run_command("sudo apt install -y git")
            if success:
                print("✅ Git installed")
            else:
                print("❌ Failed to install Git")

    def install_priority_tools(self):
        """Install high-priority tools using multiple methods"""
        print("\n🎯 Installing priority tools...")
        
        # Tool-specific installation strategies
        tool_strategies = {
            'crackmapexec': [
                ('pipx', 'crackmapexec'),
                ('pip_user', 'crackmapexec'),
                ('github', 'https://github.com/Porchetta-Industries/CrackMapExec.git', 'pip install .')
            ],
            'enum4linux': [
                ('apt', 'enum4linux'),
                ('github', 'https://github.com/cddmp/enum4linux-ng.git', 'pip install -r requirements.txt')
            ],
            'volatility3': [
                ('pipx', 'volatility3'),
                ('pip_user', 'volatility3'),
                ('apt', 'volatility3')
            ],
            'droopescan': [
                ('pipx', 'droopescan'),
                ('pip_user', 'droopescan')
            ],
            'arjun': [
                ('pipx', 'arjun'),
                ('pip_user', 'arjun')
            ],
            'xsser': [
                ('pipx', 'xsser'),
                ('pip_user', 'xsser')
            ],
            'impacket': [
                ('pipx', 'impacket'),
                ('pip_user', 'impacket'),
                ('apt', 'python3-impacket')
            ],
            'nuclei': [
                ('go', 'github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest'),
                ('apt', 'nuclei')
            ],
            'subfinder': [
                ('go', 'github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest')
            ],
            'httpx': [
                ('go', 'github.com/projectdiscovery/httpx/cmd/httpx@latest')
            ],
            'ffuf': [
                ('go', 'github.com/ffuf/ffuf@latest'),
                ('apt', 'ffuf')
            ],
            'gobuster': [
                ('go', 'github.com/OJ/gobuster/v3@latest'),
                ('apt', 'gobuster')
            ],
            'feroxbuster': [
                ('go', 'github.com/epi052/feroxbuster@latest')
            ],
            'assetfinder': [
                ('go', 'github.com/tomnomnom/assetfinder@latest')
            ],
            'hakrawler': [
                ('go', 'github.com/hakluke/hakrawler@latest')
            ],
            'gospider': [
                ('go', 'github.com/jaeles-project/gospider@latest')
            ],
            'paramspider': [
                ('go', 'github.com/devanshbatham/ParamSpider@latest'),
                ('github', 'https://github.com/devanshbatham/ParamSpider.git', 'pip install -r requirements.txt')
            ],
            'sherlock': [
                ('pipx', 'sherlock-project'),
                ('pip_user', 'sherlock-project'),
                ('github', 'https://github.com/sherlock-project/sherlock.git', 'pip install -r requirements.txt')
            ],
            'photon': [
                ('github', 'https://github.com/s0md3v/Photon.git', 'pip install -r requirements.txt')
            ],
            'dalfox': [
                ('go', 'github.com/hahwul/dalfox/v2@latest')
            ],
            'xsstrike': [
                ('github', 'https://github.com/s0md3v/XSStrike.git', 'pip install -r requirements.txt')
            ],
            'pacu': [
                ('pipx', 'pacu'),
                ('github', 'https://github.com/RhinoSecurityLabs/pacu.git', 'pip install -r requirements.txt')
            ],
            'scoutsuite': [
                ('pipx', 'scoutsuite'),
                ('pip_user', 'scoutsuite')
            ],
            'bloodhound': [
                ('apt', 'bloodhound')
            ]
        }
        
        for tool_name in self.priority_tools:
            if self.check_tool_installed(tool_name):
                print(f"✅ {tool_name} already installed")
                self.skipped_count += 1
                continue
            
            print(f"\n🎯 Installing {tool_name}...")
            
            if tool_name in tool_strategies:
                installed = False
                for method, *args in tool_strategies[tool_name]:
                    if method == 'pipx':
                        if self.install_with_pipx(tool_name, args[0] if args else tool_name):
                            installed = True
                            break
                    elif method == 'pip_user':
                        if self.install_with_pip_user(tool_name, args[0] if args else tool_name):
                            installed = True
                            break
                    elif method == 'apt':
                        if self.install_with_apt(tool_name, args[0] if args else tool_name):
                            installed = True
                            break
                    elif method == 'go':
                        if self.install_with_go(tool_name, args[0]):
                            installed = True
                            break
                    elif method == 'github':
                        if self.install_from_github(tool_name, args[0], args[1] if len(args) > 1 else None):
                            installed = True
                            break
                
                if not installed:
                    print(f"❌ Failed to install {tool_name} with any method")
                    self.failed_count += 1
            else:
                print(f"⚠️  No installation strategy for {tool_name}")
                self.failed_count += 1
            
            time.sleep(1)  # Rate limiting

    def fix_path_issues(self):
        """Fix PATH issues for installed tools"""
        print("\n🔧 Fixing PATH issues...")
        
        paths_to_add = [
            os.path.expanduser("~/.local/bin"),
            os.path.expanduser("~/go/bin"),
            "/usr/local/go/bin"
        ]
        
        bashrc_path = os.path.expanduser("~/.bashrc")
        current_path = os.environ.get('PATH', '')
        
        for path in paths_to_add:
            if os.path.exists(path) and path not in current_path:
                print(f"🔧 Adding {path} to PATH...")
                
                # Add to current session
                os.environ['PATH'] = f"{path}:{current_path}"
                current_path = os.environ['PATH']
                
                # Add to .bashrc for future sessions
                try:
                    with open(bashrc_path, 'a') as f:
                        f.write(f'\n# Added by CyberSec Pro tool installer\n')
                        f.write(f'export PATH="{path}:$PATH"\n')
                    print(f"✅ {path} added to ~/.bashrc")
                except Exception as e:
                    print(f"⚠️  Could not update ~/.bashrc: {e}")

    def update_tool_database(self):
        """Update CyberSec Pro tool database with new installations"""
        print("\n🔄 Updating tool database...")
        
        try:
            # Import the advanced detector
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
            from backend.tool_detector import AdvancedToolDetector
            
            detector = AdvancedToolDetector()
            
            # Test some key tools
            test_tools = ['crackmapexec', 'volatility3', 'nuclei', 'subfinder', 'sherlock']
            detected_count = 0
            
            for tool in test_tools:
                is_installed, version, path, method = detector.detect_tool(tool)
                if is_installed:
                    print(f"✅ {tool} detected: {version} ({method})")
                    detected_count += 1
                else:
                    print(f"❌ {tool} not detected")
            
            print(f"🔍 Detected {detected_count}/{len(test_tools)} test tools")
            
        except Exception as e:
            print(f"⚠️  Could not update tool database: {e}")

    def install_all(self):
        """Install all missing tools"""
        print("🚀 CyberSec Pro - Smart Missing Tools Installer")
        print("=" * 60)
        
        start_time = time.time()
        
        # Setup prerequisites
        self.setup_prerequisites()
        
        # Fix PATH issues first
        self.fix_path_issues()
        
        # Install priority tools
        self.install_priority_tools()
        
        # Update tool database
        self.update_tool_database()
        
        # Summary
        end_time = time.time()
        duration = int(end_time - start_time)
        
        print("\n" + "=" * 60)
        print("📊 INSTALLATION SUMMARY")
        print("=" * 60)
        print(f"✅ Installed: {self.installed_count}")
        print(f"⏭️  Skipped: {self.skipped_count}")
        print(f"❌ Failed: {self.failed_count}")
        print(f"⏱️  Duration: {duration}s")
        print("=" * 60)
        
        if self.installed_count > 0:
            print("\n🔄 Please restart your terminal or run:")
            print("source ~/.bashrc")
            print("\n🔄 Then test the new tool detection:")
            print("curl http://localhost:5001/api/tools/status")

def main():
    """Main function"""
    if os.geteuid() == 0:
        print("❌ Please don't run this script as root!")
        print("   The script will ask for sudo when needed.")
        sys.exit(1)
    
    installer = SmartToolInstaller()
    installer.install_all()

if __name__ == "__main__":
    main()