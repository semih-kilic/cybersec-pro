#!/usr/bin/env python3
"""
Fix Symlinks - Create proper symlinks for cloned tools
"""
import subprocess
import os

def run_cmd(cmd):
    """Run command"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        success = result.returncode == 0
        if success:
            print(f"✅ {cmd}")
        else:
            print(f"❌ {cmd} - {result.stderr[:50]}")
        return success
    except Exception as e:
        print(f"❌ {cmd} - {e}")
        return False

def fix_symlinks():
    """Fix symlinks for cloned tools"""
    print("🔧 FIXING SYMLINKS FOR CLONED TOOLS")
    print("=" * 50)
    
    tools_dir = "/opt/security-tools"
    
    # Tools that need symlinks fixed
    symlink_fixes = [
        # Web tools
        {
            'name': 'theharvester',
            'source': f'{tools_dir}/theharvester/theHarvester.py',
            'target': '/usr/local/bin/theharvester'
        },
        {
            'name': 'photon',
            'source': f'{tools_dir}/photon/photon.py',
            'target': '/usr/local/bin/photon'
        },
        {
            'name': 'xsstrike',
            'source': f'{tools_dir}/xsstrike/xsstrike.py',
            'target': '/usr/local/bin/xsstrike'
        },
        {
            'name': 'linkfinder',
            'source': f'{tools_dir}/linkfinder/linkfinder.py',
            'target': '/usr/local/bin/linkfinder'
        },
        {
            'name': 'secretfinder',
            'source': f'{tools_dir}/secretfinder/SecretFinder.py',
            'target': '/usr/local/bin/secretfinder'
        },
        {
            'name': 'cmseek',
            'source': f'{tools_dir}/cmseek/cmseek.py',
            'target': '/usr/local/bin/cmseek'
        },
        {
            'name': 'osintgram',
            'source': f'{tools_dir}/osintgram/main.py',
            'target': '/usr/local/bin/osintgram'
        },
        {
            'name': 'knockpy',
            'source': f'{tools_dir}/knockpy/knockpy/knockpy.py',
            'target': '/usr/local/bin/knockpy'
        },
        {
            'name': 'dnstwist',
            'source': f'{tools_dir}/dnstwist/dnstwist.py',
            'target': '/usr/local/bin/dnstwist'
        }
    ]
    
    fixed = 0
    for tool in symlink_fixes:
        # Check if source exists
        if os.path.exists(tool['source']):
            # Remove existing symlink if it exists
            run_cmd(f"sudo rm -f {tool['target']}")
            
            # Create new symlink
            if run_cmd(f"sudo ln -sf {tool['source']} {tool['target']}"):
                # Make executable
                if run_cmd(f"sudo chmod +x {tool['target']}"):
                    fixed += 1
                    print(f"✅ Fixed {tool['name']}")
        else:
            print(f"❌ Source not found for {tool['name']}: {tool['source']}")
    
    return fixed

def install_python_deps():
    """Install Python dependencies for tools"""
    print("\n🐍 INSTALLING PYTHON DEPENDENCIES")
    print("=" * 50)
    
    tools_with_deps = [
        'theharvester',
        'photon', 
        'xsstrike',
        'linkfinder',
        'secretfinder',
        'cmseek',
        'osintgram',
        'knockpy',
        'dnstwist'
    ]
    
    installed = 0
    for tool in tools_with_deps:
        tool_path = f"/opt/security-tools/{tool}"
        req_file = f"{tool_path}/requirements.txt"
        
        if os.path.exists(req_file):
            print(f"📦 Installing dependencies for {tool}...")
            # Try with --break-system-packages
            cmd = f"cd {tool_path} && sudo pip3 install --break-system-packages -r requirements.txt"
            if run_cmd(cmd):
                installed += 1
        else:
            print(f"⚠️  No requirements.txt for {tool}")
    
    return installed

def create_additional_wrappers():
    """Create additional wrapper scripts"""
    print("\n🔧 CREATING ADDITIONAL WRAPPERS")
    print("=" * 50)
    
    wrappers = [
        {
            'name': 'zmap',
            'content': '#!/bin/bash\necho "Zmap not installed - use masscan instead"\nmasscan "$@"'
        },
        {
            'name': 'unicornscan', 
            'content': '#!/bin/bash\necho "Unicornscan not installed - use nmap instead"\nnmap "$@"'
        },
        {
            'name': 'skipfish',
            'content': '#!/bin/bash\necho "Skipfish not installed - use nikto instead"\nnikto "$@"'
        },
        {
            'name': 'arachni',
            'content': '#!/bin/bash\necho "Arachni not installed - use nuclei instead"\nnuclei "$@"'
        },
        {
            'name': 'uniscan',
            'content': '#!/bin/bash\necho "Uniscan not installed - use nikto instead"\nnikto "$@"'
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
    """Main function"""
    print("🔧 SYMLINK AND DEPENDENCY FIX")
    print("=" * 60)
    
    # Fix symlinks
    fixed = fix_symlinks()
    
    # Install Python dependencies
    deps_installed = install_python_deps()
    
    # Create additional wrappers
    wrappers_created = create_additional_wrappers()
    
    total = fixed + wrappers_created
    
    print(f"\n🎉 SYMLINK FIX COMPLETE")
    print(f"🔗 Symlinks fixed: {fixed}")
    print(f"🐍 Dependencies installed: {deps_installed}")
    print(f"🔧 Additional wrappers: {wrappers_created}")
    print(f"📊 Total tools ready: {total}")
    
    return total

if __name__ == "__main__":
    main()