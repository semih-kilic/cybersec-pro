#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - Kali Linux Tool Registry v3.0
Auto-discovers and manages ALL 500+ Kali Linux security tools

Author: Semih Kılıç
Version: 3.0.0
"""

import subprocess
import shutil
import os
import json
import logging
import time
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# Plan hierarchy for tool access
PLAN_HIERARCHY = {
    "trial": 1,
    "starter": 2,
    "professional": 3,
    "team": 4,
    "enterprise": 5
}

# Category display info
CATEGORY_INFO = {
    'information_gathering': {
        'name': 'Information Gathering',
        'description': 'Tools for reconnaissance and information collection',
        'icon': '🔍',
        'color': 'blue'
    },
    'vulnerability_analysis': {
        'name': 'Vulnerability Analysis',
        'description': 'Tools for finding security vulnerabilities',
        'icon': '🔓',
        'color': 'red'
    },
    'web_application': {
        'name': 'Web Application Analysis',
        'description': 'Tools for web application security testing',
        'icon': '🌐',
        'color': 'purple'
    },
    'password_attacks': {
        'name': 'Password Attacks',
        'description': 'Tools for password cracking and analysis',
        'icon': '🔑',
        'color': 'orange'
    },
    'wireless_attacks': {
        'name': 'Wireless Attacks',
        'description': 'Tools for wireless network security testing',
        'icon': '📡',
        'color': 'cyan'
    },
    'sniffing_spoofing': {
        'name': 'Sniffing & Spoofing',
        'description': 'Tools for network traffic analysis and manipulation',
        'icon': '👃',
        'color': 'green'
    },
    'exploitation': {
        'name': 'Exploitation Tools',
        'description': 'Tools for exploiting vulnerabilities',
        'icon': '💥',
        'color': 'red'
    },
    'post_exploitation': {
        'name': 'Post Exploitation',
        'description': 'Tools for post-exploitation activities',
        'icon': '🎯',
        'color': 'yellow'
    },
    'forensics': {
        'name': 'Forensics',
        'description': 'Tools for digital forensics and analysis',
        'icon': '🔬',
        'color': 'indigo'
    },
    'reverse_engineering': {
        'name': 'Reverse Engineering',
        'description': 'Tools for reverse engineering software',
        'icon': '⚙️',
        'color': 'gray'
    },
    'reporting': {
        'name': 'Reporting Tools',
        'description': 'Tools for generating reports',
        'icon': '📊',
        'color': 'teal'
    },
    'networking': {
        'name': 'Networking',
        'description': 'General networking tools',
        'icon': '🌍',
        'color': 'blue'
    },
    'social_engineering': {
        'name': 'Social Engineering',
        'description': 'Tools for social engineering attacks',
        'icon': '🎭',
        'color': 'pink'
    },
}

class ToolRegistry:
    """Manages Kali Linux security tools registry - 500+ tools"""
    
    def __init__(self, cache_file: str = "/tmp/cybersec_tool_cache_v3.json"):
        self.cache_file = cache_file
        self.registry_file = os.path.join(os.path.dirname(__file__), 'full_tool_registry.json')
        self.tools: Dict[str, Dict] = {}
        self.categories: Dict[str, List[str]] = {}
        self._load_registry()
    
    def _load_registry(self):
        """Load tool registry from JSON file"""
        # Try cache first
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    data = json.load(f)
                    cache_time = data.get('cache_time', 0)
                    # Cache valid for 1 hour
                    if time.time() - cache_time < 3600:
                        self.tools = data.get('tools', {})
                        self.categories = data.get('categories', {})
                        if self.tools:
                            return
            except Exception as e:
                logger.error(f"Failed to load tool cache: {e}")
        
        # Load from full registry
        if os.path.exists(self.registry_file):
            try:
                with open(self.registry_file, 'r') as f:
                    data = json.load(f)
                    self.tools = data.get('tools', {})
                    
                    # Build category index
                    self.categories = {}
                    for tool_id, tool in self.tools.items():
                        cat = tool.get('category', 'information_gathering')
                        if cat not in self.categories:
                            self.categories[cat] = []
                        self.categories[cat].append(tool_id)
                    
                    self._save_cache()
                    logger.info(f"Loaded {len(self.tools)} tools from registry")
                    return
            except Exception as e:
                logger.error(f"Failed to load registry: {e}")
        
        # Fallback: discover tools
        self._discover_tools()
    
    def _save_cache(self):
        """Save tool cache to file"""
        try:
            with open(self.cache_file, 'w') as f:
                json.dump({
                    'tools': self.tools,
                    'categories': self.categories,
                    'cache_time': time.time()
                }, f)
        except Exception as e:
            logger.error(f"Failed to save tool cache: {e}")
    
    def _discover_tools(self):
        """Fallback: Discover installed tools on the system"""
        logger.info("Discovering installed security tools...")
        
        self.tools = {}
        self.categories = {}
        
        # Scan Kali menu
        kali_menu_dir = '/usr/share/kali-menu/applications/'
        if os.path.exists(kali_menu_dir):
            for filename in os.listdir(kali_menu_dir):
                if not filename.endswith('.desktop'):
                    continue
                
                tool_id = filename.replace('.desktop', '').replace('kali-', '')
                command = tool_id.split('.')[0]
                path = shutil.which(command)
                
                self.tools[tool_id] = {
                    'name': tool_id.replace('-', ' ').title(),
                    'category': 'information_gathering',
                    'description': f'{tool_id} security tool',
                    'plan_required': 'professional',
                    'command': command,
                    'dangerous': False,
                    'requires_root': False,
                    'gui_only': False,
                    'installed': path is not None,
                    'path': path,
                    'parameters': {}
                }
                
                if 'information_gathering' not in self.categories:
                    self.categories['information_gathering'] = []
                self.categories['information_gathering'].append(tool_id)
        
        self._save_cache()
        logger.info(f"Discovered {len([t for t in self.tools.values() if t.get('installed')])} installed tools")
    
    def refresh(self):
        """Force refresh tool discovery"""
        if os.path.exists(self.cache_file):
            os.remove(self.cache_file)
        
        # Re-run full discovery
        import subprocess
        try:
            subprocess.run(['python3', 'generate_full_registry.py'], 
                         cwd=os.path.dirname(__file__), 
                         capture_output=True, timeout=60)
        except:
            pass
        
        self._load_registry()
    
    def get_tool(self, tool_id: str) -> Optional[Dict]:
        """Get tool by ID"""
        tool = self.tools.get(tool_id)
        if tool:
            return {**tool, 'id': tool_id}
        return None
    
    def get_all_tools(self) -> Dict[str, Dict]:
        """Get all tools"""
        return self.tools
    
    def get_installed_tools(self) -> Dict[str, Dict]:
        """Get only installed tools"""
        return {k: {**v, 'id': k} for k, v in self.tools.items() if v.get('installed')}
    
    def get_tools_by_category(self, category: str) -> List[Dict]:
        """Get tools by category"""
        tool_ids = self.categories.get(category, [])
        return [{**self.tools[tid], 'id': tid} for tid in tool_ids if tid in self.tools]
    
    def get_tools_for_plan(self, plan: str) -> Dict[str, Dict]:
        """Get tools available for a specific plan"""
        plan_level = PLAN_HIERARCHY.get(plan, 1)
        result = {}
        
        for tool_id, tool in self.tools.items():
            if not tool.get('installed'):
                continue
            
            tool_plan = tool.get('plan_required', 'enterprise')
            tool_level = PLAN_HIERARCHY.get(tool_plan, 5)
            
            if plan_level >= tool_level:
                result[tool_id] = {**tool, 'id': tool_id}
        
        return result
    
    def get_categories(self) -> List[Dict]:
        """Get all categories with info"""
        result = []
        for cat_id, tool_ids in self.categories.items():
            installed_count = sum(1 for tid in tool_ids 
                                if self.tools.get(tid, {}).get('installed'))
            
            info = CATEGORY_INFO.get(cat_id, {
                'name': cat_id.replace('_', ' ').title(),
                'description': f'{cat_id} tools',
                'icon': '🔧',
                'color': 'gray'
            })
            
            result.append({
                'id': cat_id,
                'name': info['name'],
                'description': info['description'],
                'icon': info['icon'],
                'color': info['color'],
                'tool_count': installed_count,
                'total_count': len(tool_ids)
            })
        
        return sorted(result, key=lambda x: -x['tool_count'])
    
    def get_tool_count_by_plan(self) -> Dict[str, int]:
        """Get tool count for each plan"""
        counts = {plan: 0 for plan in PLAN_HIERARCHY.keys()}
        
        for tool in self.tools.values():
            if not tool.get('installed'):
                continue
            
            tool_plan = tool.get('plan_required', 'enterprise')
            tool_level = PLAN_HIERARCHY.get(tool_plan, 5)
            
            for plan, level in PLAN_HIERARCHY.items():
                if level >= tool_level:
                    counts[plan] += 1
        
        return counts
    
    def search_tools(self, query: str) -> List[Dict]:
        """Search tools by name or description"""
        query = query.lower()
        results = []
        
        for tool_id, tool in self.tools.items():
            if (query in tool_id.lower() or 
                query in tool.get('name', '').lower() or 
                query in tool.get('description', '').lower() or
                query in tool.get('category', '').lower()):
                results.append({**tool, 'id': tool_id})
        
        return results
    
    def can_use_tool(self, tool_id: str, user_plan: str) -> bool:
        """Check if user can use a specific tool"""
        tool = self.get_tool(tool_id)
        if not tool or not tool.get('installed'):
            return False
        
        user_level = PLAN_HIERARCHY.get(user_plan, 1)
        tool_level = PLAN_HIERARCHY.get(tool.get('plan_required', 'enterprise'), 5)
        
        return user_level >= tool_level
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get comprehensive statistics"""
        total_defined = len(self.tools)
        installed_tools = [t for t in self.tools.values() if t.get('installed')]
        total_installed = len(installed_tools)
        
        by_category = {}
        for cat, tool_ids in self.categories.items():
            by_category[cat] = sum(1 for tid in tool_ids 
                                  if self.tools.get(tid, {}).get('installed'))
        
        by_plan = self.get_tool_count_by_plan()
        
        dangerous = sum(1 for t in installed_tools if t.get('dangerous'))
        gui_tools = sum(1 for t in installed_tools if t.get('gui_only'))
        requires_root = sum(1 for t in installed_tools if t.get('requires_root'))
        
        return {
            'total_defined': total_defined,
            'total_installed': total_installed,
            'by_category': by_category,
            'by_plan': by_plan,
            'categories': self.get_categories(),
            'dangerous_tools': dangerous,
            'gui_tools': gui_tools,
            'requires_root': requires_root
        }


# Create global instance
_registry = None

def get_registry() -> ToolRegistry:
    """Get singleton registry instance"""
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
    return _registry


if __name__ == '__main__':
    # Test registry
    registry = ToolRegistry()
    stats = registry.get_statistics()
    
    print('='*70)
    print('🛡️  CYBERSEC PRO - KALI LINUX TOOL REGISTRY v3.0')
    print('='*70)
    print()
    print(f"📊 TOTAL TOOLS")
    print(f"   • Defined in Registry: {stats['total_defined']}")
    print(f"   • Installed on System: {stats['total_installed']}")
    print(f"   • Installation Rate: {(stats['total_installed']/stats['total_defined']*100):.1f}%")
    print()
    print(f"📦 TOOLS BY SUBSCRIPTION PLAN")
    for plan, count in stats['by_plan'].items():
        print(f"   • {plan.capitalize():12}: {count:3} tools")
    print()
    print(f"🏷️  TOOLS BY CATEGORY")
    for cat, count in sorted(stats['by_category'].items(), key=lambda x: -x[1]):
        print(f"   • {cat.replace('_',' ').title():25}: {count:3} tools")
    print()
    print(f"⚠️  SPECIAL CATEGORIES")
    print(f"   • Dangerous Tools: {stats['dangerous_tools']} (require extra caution)")
    print(f"   • GUI-only Tools:  {stats['gui_tools']} (desktop interface required)")
    print(f"   • Requires Root:   {stats['requires_root']} (need sudo/root access)")
    print()
    print('='*70)
    print('✅ ALL SYSTEMS OPERATIONAL!')
    print('='*70)
