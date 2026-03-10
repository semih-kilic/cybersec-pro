import React, { useState, useEffect, memo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useToolsCatalog, useToolsStats } from '../hooks/useApiQueries';

interface Tool {
  slug: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  parameter_count: number;
  preset_count: number;
  example_count: number;
  plan_required: string;
  tags: string[];
}

interface Category {
  name: string;
  count: number;
  icon: string;
}

const getPlanBadge = (plan: string) => {
  switch (plan) {
    case 'starter':
      return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">FREE</span>;
    case 'professional':
      return <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs">PRO</span>;
    case 'enterprise':
      return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">ENT</span>;
    default:
      return null;
  }
};

const ToolGridCard = memo(function ToolGridCard({ tool }: { tool: Tool }) {
  return (
    <Link
      to={`/tools/${tool.slug}`}
      className="group bg-gray-800 rounded-xl p-6 hover:bg-gray-750 border border-transparent hover:border-cyan-500/50 transition-all duration-200"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-xl font-bold flex-shrink-0 group-hover:scale-110 transition-transform">
          {tool.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold group-hover:text-cyan-400 transition-colors truncate">
              {tool.name}
            </h3>
            {getPlanBadge(tool.plan_required)}
          </div>
          <p className="text-sm text-gray-400 line-clamp-2 mb-3">
            {tool.description}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span>⚙️</span>
              <span>{tool.parameter_count} params</span>
            </span>
            <span className="flex items-center gap-1">
              <span>📋</span>
              <span>{tool.preset_count} presets</span>
            </span>
          </div>
        </div>
      </div>
      {tool.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-4 pt-4 border-t border-gray-700">
          {tool.tags.slice(0, 4).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
              {tag}
            </span>
          ))}
          {tool.tags.length > 4 && (
            <span className="px-2 py-0.5 text-xs text-gray-500">
              +{tool.tags.length - 4} more
            </span>
          )}
        </div>
      )}
    </Link>
  );
});

const ToolListRow = memo(function ToolListRow({ tool }: { tool: Tool }) {
  return (
    <Link
      to={`/tools/${tool.slug}`}
      className="group flex items-center gap-4 bg-gray-800 rounded-lg p-4 hover:bg-gray-750 border border-transparent hover:border-cyan-500/50 transition-all"
    >
      <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
        {tool.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold group-hover:text-cyan-400 transition-colors">
            {tool.name}
          </h3>
          {getPlanBadge(tool.plan_required)}
        </div>
        <p className="text-sm text-gray-400 truncate">
          {tool.description}
        </p>
      </div>
      <div className="flex items-center gap-6 text-sm text-gray-500">
        <span>{tool.category}</span>
        <span>{tool.parameter_count} params</span>
      </div>
      <div className="text-gray-500 group-hover:text-cyan-400 transition-colors">
        →
      </div>
    </Link>
  );
});

const ToolsCatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: catalogData, isLoading: loading } = useToolsCatalog();
  const { data: stats } = useToolsStats();
  const tools = catalogData?.tools || [];
  const categories = catalogData?.categories || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    searchParams.get('category')
  );
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (selectedCategory) {
      searchParams.set('category', selectedCategory);
    } else {
      searchParams.delete('category');
    }
    setSearchParams(searchParams);
  }, [selectedCategory]);

  const filteredTools = tools.filter(tool => {
    const matchesSearch = !searchQuery || 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || tool.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      'Information Gathering': '🔍',
      'Vulnerability Analysis': '⚠️',
      'Web Application Analysis': '🌐',
      'Password Attacks': '🔐',
      'Wireless Attacks': '📡',
      'Exploitation Tools': '💉',
      'Sniffing & Spoofing': '👁️',
      'Forensics': '🔬',
      'Reverse Engineering': '⚙️',
      'Reporting Tools': '📊',
      'Social Engineering': '🎭',
      'Hardware Hacking': '🔧',
    };
    return icons[category] || '🛠️';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading tools catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Security Assessment Tools
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Enterprise-grade security assessment platform with comprehensive documentation.
              Every parameter, every option, fully documented and executable.
            </p>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-8">
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-cyan-400">{stats.total_tools}</div>
                <div className="text-sm text-gray-400">Total Tools</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-cyan-400">{stats.total_parameters}</div>
                <div className="text-sm text-gray-400">Parameters</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-cyan-400">{stats.total_categories}</div>
                <div className="text-sm text-gray-400">Categories</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-cyan-400">{stats.total_presets || 0}</div>
                <div className="text-sm text-gray-400">Presets</div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools by name, description, or tags..."
                className="w-full px-6 py-4 pl-14 bg-gray-800 border border-gray-700 rounded-xl focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-white text-lg"
              />
              <span className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl">
                🔍
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar - Categories */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-gray-800 rounded-xl p-4 sticky top-4">
              <h3 className="text-lg font-semibold mb-4">Categories</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
                    !selectedCategory ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>📚</span>
                    <span>All Tools</span>
                  </span>
                  <span className="text-sm text-gray-500">{tools.length}</span>
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
                      selectedCategory === cat.name ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-gray-700 text-gray-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{getCategoryIcon(cat.name)}</span>
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="text-sm text-gray-500">{cat.count}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-gray-400">
                {filteredTools.length} {filteredTools.length === 1 ? 'tool' : 'tools'} found
                {selectedCategory && <span className="text-cyan-400 ml-2">in {selectedCategory}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tools Grid/List */}
            {viewMode === 'grid' ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredTools.map(tool => (
                  <ToolGridCard key={tool.slug} tool={tool} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTools.map(tool => (
                  <ToolListRow key={tool.slug} tool={tool} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {filteredTools.length === 0 && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">No tools found</h3>
                <p className="text-gray-400 mb-4">
                  Try adjusting your search or filter criteria
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory(null);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsCatalogPage;
