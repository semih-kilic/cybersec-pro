import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';

interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  plan_required: string;
  is_active: boolean;
  parameters?: ToolParameter[];
}

interface ToolParameter {
  name: string;
  flag: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'textarea';
  required: boolean;
  default?: string;
  placeholder?: string;
  options?: string[];
  description?: string;
}

const categoryIcons: { [key: string]: string } = {
  'Information Gathering': '🔍',
  'Vulnerability Analysis': '🎯',
  'Web Application Analysis': '🌐',
  'Password Attacks': '🔐',
  'Wireless Attacks': '📡',
  'Exploitation Tools': '💥',
  'Sniffing & Spoofing': '👁️',
  'Post Exploitation': '🚀',
  'Forensics': '🔬',
  'Reporting Tools': '📊',
  'Social Engineering': '🎭',
  'Stress Testing': '⚡',
};

const categoryColors: { [key: string]: string } = {
  'Information Gathering': 'from-blue-500 to-cyan-500',
  'Vulnerability Analysis': 'from-red-500 to-orange-500',
  'Web Application Analysis': 'from-green-500 to-emerald-500',
  'Password Attacks': 'from-purple-500 to-pink-500',
  'Wireless Attacks': 'from-yellow-500 to-amber-500',
  'Exploitation Tools': 'from-red-600 to-rose-500',
  'Sniffing & Spoofing': 'from-indigo-500 to-blue-500',
  'Post Exploitation': 'from-orange-500 to-red-500',
  'Forensics': 'from-teal-500 to-cyan-500',
  'Reporting Tools': 'from-gray-500 to-slate-500',
  'Social Engineering': 'from-pink-500 to-rose-500',
  'Stress Testing': 'from-yellow-600 to-orange-500',
};

export function ToolsPage() {
  const { token, organization } = useAuth();
  const [tools, setTools] = useState<{ [category: string]: Tool[] }>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [totalTools, setTotalTools] = useState(0);

  useEffect(() => {
    fetchTools();
  }, [token]);

  const fetchTools = async () => {
    try {
      const res = await fetch('/api/v1/tools', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTools(data.tools || {});
        setTotalTools(data.total_tools || 0);
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = Object.keys(tools);
  
  const filteredTools = Object.entries(tools).reduce((acc, [category, toolList]) => {
    if (selectedCategory && category !== selectedCategory) return acc;
    
    const filtered = toolList.filter(tool => 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as { [key: string]: Tool[] });

  const filteredCount = Object.values(filteredTools).flat().length;

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'starter':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Free</span>;
      case 'professional':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Pro</span>;
      case 'enterprise':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">Enterprise</span>;
      default:
        return null;
    }
  };

  const canUseTool = (plan: string) => {
    const userPlan = organization?.plan_type || 'starter';
    const planHierarchy = ['starter', 'professional', 'enterprise'];
    return planHierarchy.indexOf(userPlan) >= planHierarchy.indexOf(plan);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-kali-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400">Loading tools...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header 
        title="Security Tools"
        subtitle={`${totalTools} tools available across ${categories.length} categories`}
      />

      <div className="p-6">
        {/* Filters & Search */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search tools by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
            />
            <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                !selectedCategory 
                  ? 'bg-kali-blue text-white' 
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              All ({totalTools})
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition flex items-center gap-2 ${
                  selectedCategory === category 
                    ? 'bg-kali-blue text-white' 
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <span>{categoryIcons[category] || '🔧'}</span>
                {category} ({tools[category]?.length || 0})
              </button>
            ))}
          </div>

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

        {/* Results count */}
        {searchQuery && (
          <p className="text-sm text-gray-400 mb-4">
            Found {filteredCount} tools matching "{searchQuery}"
          </p>
        )}

        {/* Tools Grid */}
        {viewMode === 'grid' ? (
          <div className="space-y-8">
            {Object.entries(filteredTools).map(([category, toolList]) => (
              <div key={category}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${categoryColors[category] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-xl`}>
                    {categoryIcons[category] || '🔧'}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{category}</h2>
                    <p className="text-sm text-gray-400">{toolList.length} tools</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {toolList.map((tool) => {
                    const canUse = canUseTool(tool.plan_required);
                    return (
                      <div 
                        key={tool.id}
                        className={`bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition group ${!canUse ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${categoryColors[category] || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
                            <span className="text-lg">{categoryIcons[category] || '🔧'}</span>
                          </div>
                          {getPlanBadge(tool.plan_required)}
                        </div>
                        
                        <h3 className="text-white font-semibold mb-2 group-hover:text-kali-blue transition">
                          {tool.name}
                        </h3>
                        <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                          {tool.description || 'No description available'}
                        </p>
                        
                        <div className="flex gap-2">
                          {canUse ? (
                            <>
                              <Link 
                                to={`/dashboard/scans/new?tool=${tool.id}`}
                                className="flex-1 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white text-center rounded-lg text-sm font-medium transition"
                              >
                                Run Scan
                              </Link>
                              <Link 
                                to={`/dashboard/tools/${tool.id}`}
                                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </Link>
                            </>
                          ) : (
                            <Link 
                              to="/#pricing"
                              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white text-center rounded-lg text-sm font-medium transition"
                            >
                              Upgrade to Use
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
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(filteredTools).flatMap(([category, toolList]) =>
                  toolList.map((tool) => {
                    const canUse = canUseTool(tool.plan_required);
                    return (
                      <tr key={tool.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${categoryColors[category] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-sm`}>
                              {categoryIcons[category] || '🔧'}
                            </div>
                            <div>
                              <p className="text-white font-medium">{tool.name}</p>
                              <p className="text-xs text-gray-400 line-clamp-1">{tool.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-400">{category}</td>
                        <td className="px-5 py-4">{getPlanBadge(tool.plan_required)}</td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            {canUse ? (
                              <Link 
                                to={`/dashboard/scans/new?tool=${tool.id}`}
                                className="px-3 py-1.5 bg-kali-blue hover:bg-kali-blue/90 text-white rounded text-sm transition"
                              >
                                Run
                              </Link>
                            ) : (
                              <span className="px-3 py-1.5 bg-gray-800 text-gray-500 rounded text-sm">
                                Upgrade
                              </span>
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
        {Object.keys(filteredTools).length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No tools found</h3>
            <p className="text-gray-400">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ToolsPage;
