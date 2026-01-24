#!/usr/bin/env python3
"""
Missing Tools Analysis - Eksik araçları analiz et ve kurulum planı yap
"""
import requests
import json

def analyze_missing_tools():
    """Eksik araçları analiz et"""
    print("🔍 Missing Tools Analysis")
    print("=" * 50)
    
    try:
        # API'den eksik araçları al
        response = requests.get("http://localhost:5002/api/tools/status")
        data = response.json()
        
        missing_tools = data.get('missing_tools', [])
        print(f"📊 Total missing tools: {len(missing_tools)}")
        
        # Kategorilere göre grupla
        categories = {}
        for tool in missing_tools:
            category = tool.get('category', 'Unknown')
            if category not in categories:
                categories[category] = []
            categories[category].append(tool)
        
        print("\n📂 Missing tools by category:")
        for category, tools in categories.items():
            print(f"\n🔸 {category} ({len(tools)} tools):")
            for tool in tools[:5]:  # İlk 5'ini göster
                print(f"   - {tool['name']} ({tool.get('command', 'N/A')})")
            if len(tools) > 5:
                print(f"   ... and {len(tools) - 5} more")
        
        # Kurulum stratejisi
        print("\n" + "=" * 50)
        print("🚀 INSTALLATION STRATEGY")
        print("=" * 50)
        
        # Kolay kurulabilir araçlar
        easy_install = []
        medium_install = []
        hard_install = []
        
        for tool in missing_tools:
            name = tool['name'].lower()
            command = tool.get('command', '').lower()
            
            # APT ile kurulabilir
            if any(keyword in name for keyword in ['scan', 'enum', 'brute', 'crack']):
                easy_install.append(tool)
            # Python/pip ile kurulabilir  
            elif any(keyword in name for keyword in ['python', 'py', 'script']):
                medium_install.append(tool)
            # Manuel kurulum gerekli
            else:
                hard_install.append(tool)
        
        print(f"✅ Easy Install (APT/Snap): {len(easy_install)} tools")
        print(f"🔧 Medium Install (Python/Go): {len(medium_install)} tools")  
        print(f"⚠️  Hard Install (Manual): {len(hard_install)} tools")
        
        # Kurulum komutları öner
        print("\n📦 INSTALLATION COMMANDS:")
        
        # APT araçları
        apt_tools = [
            'unicornscan', 'zmap', 'skipfish', 'arachni', 'legion',
            'cutycapt', 'eyewitness', 'veil', 'empire-framework',
            'faraday-client', 'maltego', 'proxmark3'
        ]
        
        print(f"\n1️⃣ APT Installation:")
        print(f"sudo apt install -y {' '.join(apt_tools[:10])}")
        
        # Python araçları
        python_tools = [
            'drozer', 'mobsf', 'photon', 'osintgram', 'knockpy',
            'paramspider', 'linkfinder', 'secretfinder', 'cmseek',
            'joomscan', 'drupwn', 'cmsmap', 'nosqlmap', 'mongoaudit'
        ]
        
        print(f"\n2️⃣ Python Installation:")
        for tool in python_tools[:5]:
            print(f"pipx install {tool}")
        
        # Go araçları
        go_tools = [
            'github.com/projectdiscovery/chaos-client/cmd/chaos@latest',
            'github.com/tomnomnom/gau/v2/cmd/gau@latest',
            'github.com/tomnomnom/waybackurls@latest',
            'github.com/hakluke/haktrails@latest',
            'github.com/projectdiscovery/katana/cmd/katana@latest'
        ]
        
        print(f"\n3️⃣ Go Installation:")
        for tool in go_tools[:3]:
            print(f"go install {tool}")
        
        # Manuel kurulum
        print(f"\n4️⃣ Manual Installation:")
        print("- IDA Free: Download from hex-rays.com")
        print("- Cutter: Download from github.com/rizinorg/cutter")
        print("- JD-GUI: Download from github.com/java-decompiler/jd-gui")
        
        return {
            'total_missing': len(missing_tools),
            'easy_install': len(easy_install),
            'medium_install': len(medium_install), 
            'hard_install': len(hard_install),
            'categories': categories
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

if __name__ == "__main__":
    result = analyze_missing_tools()
    if result:
        print(f"\n🎯 Summary:")
        print(f"   Missing: {result['total_missing']}")
        print(f"   Easy: {result['easy_install']}")
        print(f"   Medium: {result['medium_install']}")
        print(f"   Hard: {result['hard_install']}")