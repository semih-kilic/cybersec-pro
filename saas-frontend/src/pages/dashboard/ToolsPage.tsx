import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  plan_required: string;
  installed: boolean;
  dangerous?: boolean;
  requires_root?: boolean;
  gui_only?: boolean;
}

interface CategoryInfo {
  name: string;
  icon: string;
  description: string;
  color: string;
}

interface CategoryData {
  info: CategoryInfo;
  tools: Tool[];
}

interface ToolsResponse {
  success: boolean;
  total_tools: number;
  categories: { [key: string]: CategoryData };
  category_list: string[];
}

// Category icons and colors mapping
const categoryIcons: { [key: string]: string } = {
  'information_gathering': '🔍',
  'vulnerability_analysis': '🔓',
  'web_application': '🌐',
  'password_attacks': '🔑',
  'wireless_attacks': '📡',
  'sniffing_spoofing': '👃',
  'exploitation': '💥',
  'post_exploitation': '🎯',
  'forensics': '🔬',
  'reverse_engineering': '⚙️',
  'reporting': '📊',
  'networking': '🌍',
};

const categoryColors: { [key: string]: string } = {
  'information_gathering': 'from-blue-500 to-cyan-500',
  'vulnerability_analysis': 'from-red-500 to-orange-500',
  'web_application': 'from-purple-500 to-pink-500',
  'password_attacks': 'from-yellow-500 to-orange-500',
  'wireless_attacks': 'from-cyan-500 to-teal-500',
  'sniffing_spoofing': 'from-green-500 to-emerald-500',
  'exploitation': 'from-red-600 to-red-400',
  'post_exploitation': 'from-yellow-600 to-amber-500',
  'forensics': 'from-indigo-500 to-purple-500',
  'reverse_engineering': 'from-gray-500 to-slate-500',
  'reporting': 'from-teal-500 to-cyan-500',
  'networking': 'from-blue-600 to-indigo-500',
};

const categoryDisplayNames: { [key: string]: string } = {
  'information_gathering': 'Information Gathering',
  'vulnerability_analysis': 'Vulnerability Analysis',
  'web_application': 'Web Application',
  'password_attacks': 'Password Attacks',
  'wireless_attacks': 'Wireless Attacks',
  'sniffing_spoofing': 'Sniffing & Spoofing',
  'exploitation': 'Exploitation',
  'post_exploitation': 'Post Exploitation',
  'forensics': 'Forensics',
  'reverse_engineering': 'Reverse Engineering',
  'reporting': 'Reporting',
  'networking': 'Networking',
};

// Plan hierarchy for access control
// Trial users get access to starter tools (same level)
const planHierarchy: { [key: string]: number } = {
  'free': 0,
  'trial': 2,  // Trial users can access starter tools
  'starter': 2,
  'professional': 3,
  'team': 4,
  'enterprise': 5,
};

export function ToolsPage() {
  const { token, organization } = useAuth();
  const [allCategories, setAllCategories] = useState<{ [key: string]: CategoryData }>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [totalTools, setTotalTools] = useState(0);
  const [categoryList, setCategoryList] = useState<string[]>([]);
  const [showOnlyInstalled, setShowOnlyInstalled] = useState(false);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'plan'>('category');

  // Get user plan from organization
  const userPlan = organization?.plan_type || 'trial';

  useEffect(() => {
    fetchTools();
  }, [token, userPlan]);

  const fetchTools = async () => {
    try {
      setLoading(true);
      // Use v2 API with plan parameter
      const res = await fetch(`/api/v2/tools?plan=${userPlan}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      
      if (res.ok) {
        const data: ToolsResponse = await res.json();
        if (data.success) {
          setAllCategories(data.categories || {});
          setTotalTools(data.total_tools || 0);
          setCategoryList(data.category_list || []);
        }
      } else {
        console.error('Failed to fetch tools:', res.status);
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user can use a tool based on plan
  const canUseTool = useCallback((toolPlan: string): boolean => {
    const userLevel = planHierarchy[userPlan.toLowerCase()] || 0;
    const toolLevel = planHierarchy[toolPlan.toLowerCase()] || 0;
    return userLevel >= toolLevel;
  }, [userPlan]);

  // Get plan badge component
  const getPlanBadge = (plan: string) => {
    const badges: { [key: string]: { bg: string; text: string; label: string } } = {
      'free': { bg: 'bg-gray-700', text: 'text-gray-300', label: 'Free' },
      'trial': { bg: 'bg-gray-600', text: 'text-gray-200', label: 'Trial' },
      'starter': { bg: 'bg-green-900/50', text: 'text-green-400', label: 'Starter' },
      'professional': { bg: 'bg-blue-900/50', text: 'text-blue-400', label: 'Pro' },
      'team': { bg: 'bg-purple-900/50', text: 'text-purple-400', label: 'Team' },
      'enterprise': { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: 'Enterprise' },
    };
    
    const badge = badges[plan.toLowerCase()] || badges['free'];
    return (
      <span className={`px-2 py-0.5 ${badge.bg} ${badge.text} text-xs font-medium rounded`}>
        {badge.label}
      </span>
    );
  };

  // Filter tools based on search, categories, and other filters
  const filteredCategories = useMemo(() => {
    const result: { [key: string]: Tool[] } = {};
    
    Object.entries(allCategories).forEach(([categoryKey, categoryData]) => {
      // Check if this category is selected (if any are selected)
      if (selectedCategories.length > 0 && !selectedCategories.includes(categoryKey)) {
        return;
      }
      
      let filteredTools = categoryData.tools.filter(tool => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesSearch = 
            tool.name.toLowerCase().includes(query) ||
            tool.description?.toLowerCase().includes(query) ||
            tool.id.toLowerCase().includes(query);
          if (!matchesSearch) return false;
        }
        
        // Installed filter
        if (showOnlyInstalled && !tool.installed) {
          return false;
        }
        
        // Available for user's plan filter
        if (showOnlyAvailable && !canUseTool(tool.plan_required)) {
          return false;
        }
        
        return true;
      });
      
      // Sort tools
      if (sortBy === 'name') {
        filteredTools.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortBy === 'plan') {
        filteredTools.sort((a, b) => 
          (planHierarchy[b.plan_required] || 0) - (planHierarchy[a.plan_required] || 0)
        );
      }
      
      if (filteredTools.length > 0) {
        result[categoryKey] = filteredTools;
      }
    });
    
    return result;
  }, [allCategories, searchQuery, selectedCategories, showOnlyInstalled, showOnlyAvailable, canUseTool, sortBy]);

  // Calculate filtered count
  const filteredCount = useMemo(() => {
    return Object.values(filteredCategories).reduce((sum, tools) => sum + tools.length, 0);
  }, [filteredCategories]);

  // Toggle category selection (multi-select)
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setShowOnlyInstalled(false);
    setShowOnlyAvailable(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-kali-blue"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Trial/Starter User Banner */}
        {(userPlan === 'trial' || userPlan === 'starter') && (
          <div className="mb-6 bg-gradient-to-r from-cyan-900/30 via-blue-900/30 to-purple-900/30 rounded-xl p-6 border border-cyan-500/30">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <span className="text-2xl">🛡️</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {(userPlan === 'trial' || userPlan === 'starter') 
                      ? `${filteredCount > 0 && showOnlyAvailable ? filteredCount : 7} Tools Available in Your Plan` 
                      : `${filteredCount > 0 && showOnlyAvailable ? filteredCount : totalTools} Tools in Your Plan`}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {(userPlan === 'trial' || userPlan === 'starter')
                      ? 'Click "My Plan" filter to see your available tools. Upgrade to unlock 395+ professional tools!' 
                      : 'Click "My Plan" to see tools included in your plan. Upgrade for more tools!'}
                  </p>
                </div>
              </div>
              <Link 
                to="/dashboard/billing/upgrade"
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-lg transition flex items-center gap-2"
              >
                <span>Upgrade Now</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        )}

        {/* Quick Access: Your Trial Tools */}
        {(userPlan === 'trial' || userPlan === 'starter') && !showOnlyAvailable && (
          <div className="mb-6 bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-xl p-5 border border-emerald-500/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✨</span>
                <div>
                  <h3 className="text-white font-bold">Quick Access: Your 7 Trial Tools</h3>
                  <p className="text-gray-400 text-sm">Click any tool to start scanning immediately</p>
                </div>
              </div>
              <button
                onClick={() => setShowOnlyAvailable(true)}
                className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
              >
                Show Only My Tools →
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { id: 'nmap', name: 'Nmap', icon: '🔍', desc: 'Port Scanner' },
                { id: 'nikto', name: 'Nikto', icon: '🌐', desc: 'Web Scanner' },
                { id: 'whatweb', name: 'WhatWeb', icon: '🔎', desc: 'Web Tech' },
                { id: 'ncrack', name: 'Ncrack', icon: '🔑', desc: 'Password' },
                { id: 'tcpdump', name: 'TCPDump', icon: '📡', desc: 'Packets' },
                { id: 'netcat', name: 'Netcat', icon: '🔗', desc: 'Network' },
                { id: 'ncat', name: 'Ncat', icon: '⚡', desc: 'TCP/UDP' },
              ].map((tool) => (
                <Link 
                  key={tool.id}
                  to={`/dashboard/tools/${tool.id}`}
                  className="bg-gray-800/60 hover:bg-emerald-900/40 border border-gray-700 hover:border-emerald-500/50 rounded-lg p-3 text-center transition group"
                >
                  <div className="text-xl mb-1">{tool.icon}</div>
                  <div className="text-white font-medium text-sm group-hover:text-emerald-400 transition">{tool.name}</div>
                  <div className="text-gray-500 text-xs">{tool.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Security Tools</h1>
          <p className="text-gray-400">
            {totalTools} professional security tools available • Your plan: <span className="text-kali-blue font-medium capitalize">{userPlan}</span>
            {showOnlyAvailable && <span className="ml-2 text-cyan-400">• Showing {filteredCount} tools in your plan</span>}
          </p>
        </div>

        {/* Search and Filters Bar */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search tools by name, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-kali-blue focus:outline-none"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter Toggles */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowOnlyInstalled(!showOnlyInstalled)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  showOnlyInstalled 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                ✓ Installed Only
              </button>
              <button
                onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                  showOnlyAvailable 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25' 
                    : 'bg-gray-800 text-gray-300 hover:text-white border border-cyan-500/50 hover:border-cyan-500'
                }`}
              >
                <span>🎯</span>
                <span>My Plan</span>
                {!showOnlyAvailable && (userPlan === 'trial' || userPlan === 'starter') && (
                  <span className="bg-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded text-xs">
                    7
                  </span>
                )}
              </button>
              
              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'category' | 'plan')}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-kali-blue focus:outline-none"
              >
                <option value="category">Sort by Category</option>
                <option value="name">Sort by Name</option>
                <option value="plan">Sort by Plan</option>
              </select>

              {/* View Toggle */}
              <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Category Multi-Select */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-400">Categories:</span>
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="text-xs text-kali-blue hover:underline"
                >
                  Clear selection ({selectedCategories.length})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryList.map(category => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-1.5 ${
                    selectedCategories.includes(category)
                      ? 'bg-kali-blue text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <span>{categoryIcons[category] || '🔧'}</span>
                  <span>{categoryDisplayNames[category] || category}</span>
                  <span className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">
                    {allCategories[category]?.tools?.length || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-400">
            Showing <span className="text-white font-medium">{filteredCount}</span> of <span className="text-white font-medium">{totalTools}</span> tools
            {searchQuery && <span> matching "<span className="text-kali-blue">{searchQuery}</span>"</span>}
            {selectedCategories.length > 0 && <span> in {selectedCategories.length} categories</span>}
          </p>
          
          {(searchQuery || selectedCategories.length > 0 || showOnlyInstalled || showOnlyAvailable) && (
            <button
              onClick={clearFilters}
              className="text-sm text-kali-blue hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Tools Display */}
        {viewMode === 'grid' ? (
          <div className="space-y-8">
            {Object.entries(filteredCategories).map(([categoryKey, tools]) => (
              <div key={categoryKey}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${categoryColors[categoryKey] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-xl`}>
                    {categoryIcons[categoryKey] || '🔧'}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {categoryDisplayNames[categoryKey] || categoryKey}
                    </h2>
                    <p className="text-sm text-gray-400">{tools.length} tools</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {tools.map((tool) => {
                    const canUse = canUseTool(tool.plan_required);
                    return (
                      <div 
                        key={tool.id}
                        className={`bg-gray-900 rounded-xl border p-5 transition group relative ${
                          canUse 
                            ? 'border-gray-800 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10' 
                            : 'border-gray-800/50 opacity-50 hover:opacity-70'
                        }`}
                      >
                        {/* Available Badge for Trial Users */}
                        {canUse && (userPlan === 'trial' || userPlan === 'starter') && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${categoryColors[categoryKey] || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
                            <span className="text-lg">{categoryIcons[categoryKey] || '🔧'}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getPlanBadge(tool.plan_required)}
                            {tool.installed && (
                              <span className="text-xs text-green-400">✓ Installed</span>
                            )}
                            {tool.gui_only && (
                              <span className="text-xs text-yellow-400" title="Requires desktop environment (VNC/RDP)">🖥️ GUI Only</span>
                            )}
                            {tool.requires_root && (
                              <span className="text-xs text-orange-400" title="Runs with elevated privileges">🔐 Root</span>
                            )}
                            {tool.dangerous && (
                              <span className="text-xs text-red-400" title="Use with caution - may affect target systems">⚠️ Dangerous</span>
                            )}
                          </div>
                        </div>
                        
                        <h3 className="text-white font-semibold mb-2 group-hover:text-kali-blue transition">
                          {tool.name}
                        </h3>
                        <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                          {tool.description || 'No description available'}
                        </p>
                        
                        <div className="flex gap-2">
                          {canUse ? (
                            tool.gui_only ? (
                              <div className="flex-1 py-2 bg-yellow-900/30 text-yellow-400 text-center rounded-lg text-sm font-medium cursor-not-allowed" title="This tool requires a desktop environment. Use VNC or RDP to access.">
                                🖥️ Desktop Required
                              </div>
                            ) : (
                              <>
                                <Link 
                                  to={`/dashboard/tools/${tool.id}`}
                                  className="flex-1 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white text-center rounded-lg text-sm font-medium transition"
                                >
                                  {tool.requires_root ? '🔐 Run as Root' : '⚡ Run Tool'}
                                </Link>
                              </>
                            )
                          ) : (
                            <Link 
                              to="/#pricing"
                              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white text-center rounded-lg text-sm font-medium transition"
                            >
                              🔒 Upgrade to Use
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                  <th className="px-5 py-3 font-medium">Tool</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(filteredCategories).flatMap(([categoryKey, tools]) =>
                  tools.map((tool) => {
                    const canUse = canUseTool(tool.plan_required);
                    return (
                      <tr key={tool.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${categoryColors[categoryKey] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-sm`}>
                              {categoryIcons[categoryKey] || '🔧'}
                            </div>
                            <div>
                              <p className="text-white font-medium">{tool.name}</p>
                              <p className="text-xs text-gray-400 line-clamp-1 max-w-xs">{tool.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-400">
                          {categoryDisplayNames[categoryKey] || categoryKey}
                        </td>
                        <td className="px-5 py-4">{getPlanBadge(tool.plan_required)}</td>
                        <td className="px-5 py-4">
                          {tool.installed ? (
                            <span className="text-green-400 text-sm">✓ Installed</span>
                          ) : (
                            <span className="text-gray-500 text-sm">Not installed</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            {canUse ? (
                              <Link 
                                to={`/dashboard/tools/${tool.id}`}
                                className="px-3 py-1.5 bg-kali-blue hover:bg-kali-blue/90 text-white rounded text-sm transition"
                              >
                                Run
                              </Link>
                            ) : (
                              <Link 
                                to="/#pricing"
                                className="px-3 py-1.5 bg-gray-800 text-gray-400 hover:text-white rounded text-sm transition"
                              >
                                Upgrade
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {Object.keys(filteredCategories).length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No tools found</h3>
            <p className="text-gray-400 mb-4">Try adjusting your search or filter criteria.</p>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg transition"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ToolsPage;
