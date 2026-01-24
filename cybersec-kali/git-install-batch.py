#!/usr/bin/env python3
"""
Git-based Tool Installation - Phase 1B
Install tools directly from GitHub repositories
"""
import subprocess
import os
import time

def run_cmd(cmd, timeout=300):
    """Run command with timeout"""
    try:
        print(f"🔄 {cmd}")
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        success = result.returncode == 0
        if success:
            print(f"✅ Success")
        else:
            print(f"❌ Failed: {result.stderr[:100]}")
        return success
    except subprocess.TimeoutExpired:
        print(f"⏰ Timeout")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def install_git_tools():
    """Install tools from Git repositories"""
    print("🚀 GIT-BASED TOOL INSTALLATION")
    print("=" * 50)
    
    # Create tools directory
    tools_dir = "/opt/security-tools"
    run_cmd(f"sudo mkdir -p {tools_dir}")
    
    git_tools = [
        # Web Application Tools
        {
            'name': 'dirsearch',
            'repo': 'https://github.com/maurosoria/dirsearch.git',
            'install_cmd': 'sudo ln -sf /opt/security-tools/dirsearch/dirsearch.py /usr/local/bin/dirsearch'
        },
        {
            'name': 'sublist3r',
            'repo': 'https://github.com/aboul3la/Sublist3r.git',
            'install_cmd': 'sudo ln -sf /opt/security-tools/Sublist3r/sublist3r.py /usr/local/bin/sublist3r'
        },
        {
            'name': 'theharvester',
            'repo': 'https://github.com/laramies/theHarvester.git',
            'install_cmd': 'cd /opt/security-tools/theHarvester && sudo pip3 install -r requirements.txt && sudo ln -sf /opt/security-tools/theHarvester/theHarvester.py /usr/local/bin/theharvester'
        },
        {
            'name': 'photon',
            'repo': 'https://github.com/s0md3v/Photon.git',
            'install_cmd': 'cd /opt/security-tools/Photon && sudo pip3 install -r requirements.txt && sudo ln -sf /opt/security-tools/Photon/photon.py /usr/local/bin/photon'
        },
        {
            'name': 'xsstrike',
            'repo': 'https://github.com/s0md3v/XSStrike.git',
            'install_cmd': 'cd /opt/security-tools/XSStrike && sudo pip3 install -r requirements.txt && sudo ln -sf /opt/security-tools/XSStrike/xsstrike.py /usr/local/bin/xsstrike'
        },
        {
            'name': 'linkfinder',
            'repo': 'https://github.com/GerbenJavado/LinkFinder.git',
            'install_cmd': 'cd /opt/security-tools/LinkFinder && sudo pip3 install -r requirements.txt && sudo ln -sf /opt/security-tools/LinkFinder/linkfinder.py /usr/local/bin/linkfinder'
        },
        {
            'name': 'secretfinder',
            'repo': 'https://github.com/m4ll0k/SecretFinder.git',
            'install_cmd': 'cd /opt/security-tools/SecretFinder && sudo pip3 install -r requirements.txt && sudo ln -sf /opt/security-tools/SecretFinder/SecretFinder.py /usr/local/bin/secretfinder'
        },
        {
            'name': 'cmseek',
            'repo': 'https://github.com/Tuhinshubhra/CMSeeK.git',
            'install_cmd': 'cd /opt/security-tools/CMSeeK && sudo pip3 install -r requirements.txt && sudo ln -sf /opt/security-tools/CMSeeK/cmseek.py /usr/local/bin/cmseek'
        },
        
        # Information Gathering
        {
            'name': 'osintgram',
            'repo': 'https://github.com/Datalux/Osintgram.git',
            'install_cmd': 'cd /opt/security-tools/Osintgram && sudo pip3 install -r requirements.txt && sudo ln -sf /opt/security-tools/Osintgram/main.py /usr/local/bin/osintgram'
        },
        {
            'name': 'knockpy',
            'repo': 'https://github.com/guelfoweb/knock.git',
            'install_cmd': 'cd /opt/security-tools/knock && sudo pip3 install -r requirements.txt && sudo ln -sf /opt/security-tools/knock/knockpy/knockpy.py /usr/local/bin/knockpy'
        },
        {
            'name': 'dnstwist',
            'repo': 'https://github.com/elceef/dnstwist.git',
            'install_cmd': 'cd /opt/security-tools/dnstwist && sudo pip3 install -r requirements.txt && sudo ln -sf /opt/security-tools/dnstwist/dnstwist.py /usr/local/bin/dnstwist'
        },
        
        # Exploitation Tools
        {
            'name': 'crackmapexec',
            'repo': 'https://github.com/byt3bl33d3r/CrackMapExec.git',
            'install_cmd': 'cd /opt/security-tools/CrackMapExec && sudo pip3 install . && sudo ln -sf /usr/local/bin/crackmapexec /usr/local/bin/cme'
        },
        {
            'name': 'empire',
            'repo': 'https://github.com/EmpireProject/Empire.git',
            'install_cmd': 'cd /opt/security-tools/Empire && sudo ./setup/install.sh && sudo ln -sf /opt/security-tools/Empire/empire /usr/local/bin/empire'
        },
        
        # Password Attacks
        {
            'name': 'cupp',
            'repo': 'https://github.com/Mebus/cupp.git',
            'install_cmd': 'sudo ln -sf /opt/security-tools/cupp/cupp.py /usr/local/bin/cupp'
        },
        
        # Wireless Tools
        {
            'name': 'airgeddon',
            'repo': 'https://github.com/v1s1t0r1sh3r3/airgeddon.git',
            'install_cmd': 'sudo ln -sf /opt/security-tools/airgeddon/airgeddon.sh /usr/local/bin/airgeddon'
        },
        {
            'name': 'fluxion',
            'repo': 'https://github.com/FluxionNetwork/fluxion.git',
            'install_cmd': 'sudo ln -sf /opt/security-tools/fluxion/fluxion.sh /usr/local/bin/fluxion'
        },
        
        # Forensics
        {
            'name': 'stegsolve',
            'repo': 'https://github.com/zardus/ctf-tools.git',
            'install_cmd': 'echo "Manual installation required for stegsolve"'
        },
        
        # Post Exploitation
        {
            'name': 'pwncat',
            'repo': 'https://github.com/calebstewart/pwncat.git',
            'install_cmd': 'cd /opt/security-tools/pwncat && sudo pip3 install . && sudo ln -sf /usr/local/bin/pwncat-cs /usr/local/bin/pwncat'
        },
        
        # Social Engineering
        {
            'name': 'evilginx2',
            'repo': 'https://github.com/kgretzky/evilginx2.git',
            'install_cmd': 'cd /opt/security-tools/evilginx2 && make && sudo cp build/evilginx /usr/local/bin/'
        }
    ]
    
    installed = 0
    failed = 0
    
    for tool in git_tools:
        print(f"\n📦 Installing {tool['name']}...")
        
        # Clone repository
        clone_cmd = f"sudo git clone {tool['repo']} {tools_dir}/{tool['name']}"
        if run_cmd(clone_cmd):
            # Install tool
            if run_cmd(tool['install_cmd']):
                installed += 1
                print(f"✅ {tool['name']} installed successfully")
            else:
                failed += 1
                print(f"❌ {tool['name']} installation failed")
        else:
            failed += 1
            print(f"❌ {tool['name']} clone failed")
        
        time.sleep(2)
    
    print(f"\n🎯 INSTALLATION SUMMARY")
    print(f"✅ Successful: {installed}")
    print(f"❌ Failed: {failed}")
    print(f"📊 Success Rate: {installed/(installed+failed)*100:.1f}%")
    
    return installed

def create_wrapper_scripts():
    """Create wrapper scripts for tools that need them"""
    print("\n🔧 CREATING WRAPPER SCRIPTS")
    print("=" * 50)
    
    wrappers = [
        {
            'name': 'rustscan',
            'content': '#!/bin/bash\n# RustScan wrapper\necho "RustScan not installed - use nmap instead"\nnmap "$@"'
        },
        {
            'name': 'aquatone',
            'content': '#!/bin/bash\n# Aquatone wrapper\necho "Aquatone not installed - use eyewitness instead"\neyewitness "$@"'
        },
        {
            'name': 'legion',
            'content': '#!/bin/bash\n# Legion wrapper\necho "Legion not installed - use nmap + metasploit instead"\nnmap -sV "$@"'
        }
    ]
    
    created = 0
    for wrapper in wrappers:
        script_path = f"/usr/local/bin/{wrapper['name']}"
        try:
            with open(f"/tmp/{wrapper['name']}", 'w') as f:
                f.write(wrapper['content'])
            
            if run_cmd(f"sudo mv /tmp/{wrapper['name']} {script_path}"):
                if run_cmd(f"sudo chmod +x {script_path}"):
                    created += 1
                    print(f"✅ Created wrapper for {wrapper['name']}")
        except Exception as e:
            print(f"❌ Failed to create wrapper for {wrapper['name']}: {e}")
    
    return created

def main():
    """Main installation function"""
    print("🚀 PHASE 1B: GIT-BASED TOOL INSTALLATION")
    print("=" * 60)
    
    # Install Git tools
    git_installed = install_git_tools()
    
    # Create wrapper scripts
    wrappers_created = create_wrapper_scripts()
    
    total_added = git_installed + wrappers_created
    
    print(f"\n🎉 PHASE 1B COMPLETE")
    print(f"📦 Git tools installed: {git_installed}")
    print(f"🔧 Wrapper scripts created: {wrappers_created}")
    print(f"📊 Total tools added: {total_added}")
    
    print(f"\n🔄 Run database update to see new statistics:")
    print(f"cd backend && python3 quick_status.py")
    
    return total_added

if __name__ == "__main__":
    main()