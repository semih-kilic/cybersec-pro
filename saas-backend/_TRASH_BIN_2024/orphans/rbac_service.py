#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - RBAC Service
Role-Based Access Control for Security Tools

Author: Semih Kılıç
Version: 1.0.0
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import IntEnum
import json


class PlanLevel(IntEnum):
    """Plan hierarchy levels"""
    TRIAL = 1      # Trial users get STARTER tool access
    STARTER = 1    # Same level as Trial
    PROFESSIONAL = 2
    TEAM = 3
    ENTERPRISE = 4


# ================================
# PLAN DEFINITIONS
# ================================
PLAN_CONFIGS = {
    'trial': {
        'level': PlanLevel.TRIAL,
        'display_name': 'Trial',
        'price': 0,
        'daily_scan_limit': 5,
        'monthly_scan_limit': 50,
        'concurrent_scans': 1,
        'multi_tool_limit': 1,
        'project_limit': 1,
        'team_member_limit': 1,
        'remote_agent_limit': 0,
        'features': {
            'api_access': False,
            'pdf_reports': False,
            'html_reports': False,
            'slack_integration': False,
            'teams_integration': False,
            'sso': False,
            'compliance_reports': False,
            'priority_support': False,
        },
        'tool_categories': ['information_gathering'],  # Limited categories
    },
    'starter': {
        'level': PlanLevel.STARTER,
        'display_name': 'Starter',
        'price': 0,
        'daily_scan_limit': 10,
        'monthly_scan_limit': 300,
        'concurrent_scans': 1,
        'multi_tool_limit': 1,
        'project_limit': 1,
        'team_member_limit': 1,
        'remote_agent_limit': 0,
        'features': {
            'api_access': False,
            'pdf_reports': False,
            'html_reports': True,
            'json_reports': True,
            'slack_integration': False,
            'teams_integration': False,
            'sso': False,
            'compliance_reports': False,
            'priority_support': False,
        },
        'tool_categories': None,  # Access by tool_tier, not category
    },
    'professional': {
        'level': PlanLevel.PROFESSIONAL,
        'display_name': 'Professional',
        'price': 29,
        'daily_scan_limit': 50,
        'monthly_scan_limit': 1500,
        'concurrent_scans': 3,
        'multi_tool_limit': 3,
        'project_limit': 5,
        'team_member_limit': 1,
        'remote_agent_limit': 0,
        'features': {
            'api_access': True,
            'pdf_reports': True,
            'html_reports': True,
            'json_reports': True,
            'slack_integration': False,
            'teams_integration': False,
            'sso': False,
            'compliance_reports': False,
            'priority_support': False,
        },
    },
    'team': {
        'level': PlanLevel.TEAM,
        'display_name': 'Team',
        'price': 79,
        'daily_scan_limit': 100,
        'monthly_scan_limit': 3000,
        'concurrent_scans': 5,
        'multi_tool_limit': 5,
        'project_limit': 20,
        'team_member_limit': 5,
        'remote_agent_limit': 1,
        'features': {
            'api_access': True,
            'pdf_reports': True,
            'html_reports': True,
            'json_reports': True,
            'slack_integration': True,
            'teams_integration': True,
            'sso': False,
            'compliance_reports': False,
            'priority_support': True,
        },
    },
    'enterprise': {
        'level': PlanLevel.ENTERPRISE,
        'display_name': 'Enterprise',
        'price': 149,
        'daily_scan_limit': -1,  # Unlimited
        'monthly_scan_limit': -1,
        'concurrent_scans': -1,
        'multi_tool_limit': -1,
        'project_limit': -1,
        'team_member_limit': -1,
        'remote_agent_limit': -1,
        'features': {
            'api_access': True,
            'pdf_reports': True,
            'html_reports': True,
            'json_reports': True,
            'slack_integration': True,
            'teams_integration': True,
            'sso': True,
            'compliance_reports': True,
            'priority_support': True,
            '24_7_support': True,
            'custom_integrations': True,
            'founder_mode': True,
        },
    },
}


# ================================
# TOOL ACCESS MATRIX
# ================================
# Tools are assigned to minimum plan levels
# Higher plans automatically get access

STARTER_TOOLS = [
    # 6 Essential Tools
    'nmap',           # Network scanner
    'nikto',          # Web vulnerability scanner  
    'whatweb',        # Web technology identifier
    'ncrack',         # Password cracker
    'tcpdump',        # Packet analyzer
    'netcat',         # Network utility
    'ncat',           # Improved netcat
]

PROFESSIONAL_TOOLS = [
    # Web Application
    'sqlmap', 'wpscan', 'burpsuite', 'zaproxy', 'gobuster', 'ffuf', 'wfuzz',
    'dirb', 'dirbuster', 'feroxbuster', 'nuclei', 'httpx', 'subfinder',
    
    # Information Gathering
    'theHarvester', 'recon-ng', 'maltego', 'spiderfoot', 'amass', 'dnsrecon',
    'dnsenum', 'fierce', 'dmitry', 'enum4linux', 'nbtscan', 'smbmap',
    
    # Vulnerability Analysis
    'openvas', 'nessus', 'nikto', 'skipfish', 'wapiti', 'arachni',
    
    # Password Attacks
    'hydra', 'john', 'hashcat', 'medusa', 'crunch', 'cewl',
    
    # Wireless
    'aircrack-ng', 'kismet', 'reaver', 'wifite', 'bully',
    
    # Sniffing & Spoofing
    'wireshark', 'ettercap', 'bettercap', 'arpspoof', 'dnsspoof',
    'mitmproxy', 'sslstrip', 'responder',
    
    # ... (350+ more tools in professional tier)
]

TEAM_TOOLS = [
    # Advanced Exploitation (requires team for multi-user coordination)
    'metasploit', 'armitage', 'cobalt-strike-client',
    
    # Collaboration Tools
    'dradis', 'faraday', 'defectdojo',
    
    # Advanced Forensics
    'autopsy', 'volatility', 'sleuthkit',
    
    # Red Team Tools
    'empire', 'covenant', 'sliver',
    
    # Cloud Security
    'prowler', 'scoutsuite', 'pacu',
]

ENTERPRISE_TOOLS = [
    # High-Impact Tools (require enterprise for liability)
    'starkiller',     # Empire GUI
    'bloodhound',     # AD analysis
    'sharphound',     # BloodHound collector
    'mimikatz',       # Credential extraction
    'impacket-*',     # Impacket suite
    
    # Offensive Tools
    'crackmapexec',   # Network pwning
    'evil-winrm',     # Windows Remote Management
    'chisel',         # TCP tunneling
    
    # Specialized
    'ghidra',         # Reverse engineering
    'cutter',         # RE GUI
    'radare2',        # RE framework
]


@dataclass
class UserContext:
    """Represents a user's access context"""
    user_id: str
    email: str
    organization_id: str
    base_plan: str  # Actual subscribed plan
    effective_plan: str  # Plan being used (for founder mode)
    plan_level: int
    is_founder: bool = False
    is_admin: bool = False
    
    # Overrides
    allowed_tools: List[str] = field(default_factory=list)
    blocked_tools: List[str] = field(default_factory=list)
    
    # Limits (from plan or overrides)
    daily_scan_limit: int = 10
    concurrent_scan_limit: int = 1
    multi_tool_limit: int = 1
    
    # Current usage
    scans_today: int = 0
    active_scans: int = 0


class RBACService:
    """
    Role-Based Access Control Service
    
    Handles all permission checks for tools and features.
    """
    
    def __init__(self, db=None):
        self.db = db
        self._tool_tiers: Dict[str, int] = {}
        self._load_tool_tiers()
    
    def _load_tool_tiers(self):
        """Load tool tier mappings"""
        # Assign starter tools
        for tool in STARTER_TOOLS:
            self._tool_tiers[tool] = PlanLevel.STARTER
        
        # Professional tools
        for tool in PROFESSIONAL_TOOLS:
            if tool not in self._tool_tiers:
                self._tool_tiers[tool] = PlanLevel.PROFESSIONAL
        
        # Team tools
        for tool in TEAM_TOOLS:
            self._tool_tiers[tool] = PlanLevel.TEAM
        
        # Enterprise tools
        for tool in ENTERPRISE_TOOLS:
            self._tool_tiers[tool] = PlanLevel.ENTERPRISE
    
    def get_user_context(self, user_id: str) -> UserContext:
        """
        Build complete access context for a user.
        Combines plan, overrides, and current usage.
        """
        # In production, fetch from database
        # For now, return mock data
        return UserContext(
            user_id=user_id,
            email="user@example.com",
            organization_id="org_123",
            base_plan="enterprise",
            effective_plan="enterprise",
            plan_level=PlanLevel.ENTERPRISE,
            is_founder=True,
            daily_scan_limit=-1,  # Unlimited
            concurrent_scan_limit=-1,
            multi_tool_limit=-1,
        )
    
    def can_access_tool(self, user_ctx: UserContext, tool_id: str) -> tuple[bool, str]:
        """
        Check if user can access a specific tool.
        
        Returns:
            (allowed: bool, reason: str)
        """
        # 1. Check if tool is explicitly blocked
        if tool_id in user_ctx.blocked_tools:
            return False, "Tool is blocked for your account"
        
        # 2. Check if tool is explicitly allowed (override)
        if tool_id in user_ctx.allowed_tools:
            return True, "Tool access granted via override"
        
        # 3. Check plan level
        tool_tier = self._get_tool_tier(tool_id)
        
        if user_ctx.plan_level >= tool_tier:
            return True, "Access granted"
        
        # 4. Founder mode - can view but may have restrictions
        if user_ctx.is_founder and user_ctx.base_plan == 'enterprise':
            # Founders can use all tools regardless of simulated plan
            return True, "Access granted (Founder Mode)"
        
        # 5. Determine required plan
        required_plan = self._get_plan_name(tool_tier)
        return False, f"Tool requires {required_plan} plan or higher"
    
    def can_run_scan(self, user_ctx: UserContext) -> tuple[bool, str]:
        """Check if user can run a new scan (within limits)"""
        
        # Unlimited check
        if user_ctx.daily_scan_limit == -1:
            return True, "Unlimited scans"
        
        # Daily limit check
        if user_ctx.scans_today >= user_ctx.daily_scan_limit:
            return False, f"Daily scan limit reached ({user_ctx.daily_scan_limit})"
        
        # Concurrent scan check
        if user_ctx.concurrent_scan_limit != -1:
            if user_ctx.active_scans >= user_ctx.concurrent_scan_limit:
                return False, f"Concurrent scan limit reached ({user_ctx.concurrent_scan_limit})"
        
        return True, "Scan allowed"
    
    def can_access_feature(self, user_ctx: UserContext, feature: str) -> bool:
        """Check if user has access to a feature"""
        plan_config = PLAN_CONFIGS.get(user_ctx.effective_plan, {})
        features = plan_config.get('features', {})
        return features.get(feature, False)
    
    def get_available_tools(self, user_ctx: UserContext) -> Dict[str, Any]:
        """
        Get all tools available to user with access status.
        
        Returns tools grouped by access status:
        - available: Can use now
        - upgrade_required: Need higher plan
        - blocked: Explicitly blocked
        """
        result = {
            'available': [],
            'upgrade_required': [],
            'blocked': []
        }
        
        for tool_id, tier in self._tool_tiers.items():
            if tool_id in user_ctx.blocked_tools:
                result['blocked'].append({
                    'id': tool_id,
                    'tier': tier,
                    'reason': 'Blocked'
                })
            elif user_ctx.plan_level >= tier or tool_id in user_ctx.allowed_tools:
                result['available'].append({
                    'id': tool_id,
                    'tier': tier
                })
            else:
                result['upgrade_required'].append({
                    'id': tool_id,
                    'tier': tier,
                    'required_plan': self._get_plan_name(tier)
                })
        
        return result
    
    def set_founder_simulation(self, user_id: str, simulated_plan: Optional[str]) -> bool:
        """
        Enable/disable founder plan simulation.
        
        Allows enterprise founders to experience other plans.
        """
        # Validate user is founder
        user_ctx = self.get_user_context(user_id)
        if not user_ctx.is_founder:
            return False
        
        # Set simulation
        # In production: UPDATE user_plan_overrides SET simulated_plan = ? WHERE user_id = ?
        return True
    
    def _get_tool_tier(self, tool_id: str) -> int:
        """Get the minimum plan level required for a tool"""
        # Check exact match
        if tool_id in self._tool_tiers:
            return self._tool_tiers[tool_id]
        
        # Check patterns (e.g., impacket-*)
        for pattern, tier in self._tool_tiers.items():
            if pattern.endswith('*'):
                prefix = pattern[:-1]
                if tool_id.startswith(prefix):
                    return tier
        
        # Default to professional (most tools)
        return PlanLevel.PROFESSIONAL
    
    def _get_plan_name(self, level: int) -> str:
        """Get plan name from level"""
        for name, config in PLAN_CONFIGS.items():
            if config['level'] == level:
                return config['display_name']
        return "Unknown"
    
    def get_plan_tool_counts(self) -> Dict[str, int]:
        """Get tool counts for each plan (cumulative)"""
        counts = {plan: 0 for plan in PLAN_CONFIGS.keys()}
        
        for tool_id, tier in self._tool_tiers.items():
            for plan, config in PLAN_CONFIGS.items():
                if config['level'] >= tier:
                    counts[plan] += 1
        
        return counts
    
    def get_access_matrix(self) -> Dict[str, Any]:
        """
        Generate complete access matrix for documentation/UI.
        """
        matrix = {}
        
        for plan_name, plan_config in PLAN_CONFIGS.items():
            level = plan_config['level']
            tools = [tid for tid, tier in self._tool_tiers.items() if level >= tier]
            
            matrix[plan_name] = {
                'display_name': plan_config['display_name'],
                'price': plan_config['price'],
                'level': level,
                'tool_count': len(tools),
                'daily_scans': plan_config['daily_scan_limit'],
                'concurrent_scans': plan_config['concurrent_scans'],
                'multi_tool_limit': plan_config['multi_tool_limit'],
                'features': plan_config['features'],
                'sample_tools': tools[:10],  # First 10 tools
            }
        
        return matrix


# ================================
# USAGE EXAMPLE
# ================================
if __name__ == '__main__':
    rbac = RBACService()
    
    # Test access matrix
    print("=" * 60)
    print("🛡️ CyberSec Pro - Access Matrix")
    print("=" * 60)
    
    matrix = rbac.get_access_matrix()
    for plan, info in matrix.items():
        print(f"\n📋 {info['display_name']} (€{info['price']}/mo)")
        print(f"   Tools: {info['tool_count']}")
        print(f"   Daily Scans: {info['daily_scans']}")
        print(f"   Concurrent: {info['concurrent_scans']}")
    
    # Test user access
    print("\n" + "=" * 60)
    print("👤 Testing User Access (Enterprise Founder)")
    print("=" * 60)
    
    user_ctx = rbac.get_user_context("user_123")
    
    # Test specific tools
    test_tools = ['nmap', 'metasploit', 'starkiller', 'bloodhound']
    for tool in test_tools:
        allowed, reason = rbac.can_access_tool(user_ctx, tool)
        status = "✅" if allowed else "❌"
        print(f"   {status} {tool}: {reason}")
