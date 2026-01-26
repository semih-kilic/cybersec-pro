import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

// Tool Detail Page - Like kali.org/tools/nmap
const ToolDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [tool, setTool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedParams, setSelectedParams] = useState<Record<string, any>>({});
  const [generatedCommand, setGeneratedCommand] = useState('');
  const [target, setTarget] = useState('');
  const [scanRunning, setScanRunning] = useState(false);
  const [scanOutput, setScanOutput] = useState('');

  useEffect(() => {
    fetchToolDetails();
  }, [slug]);

  const fetchToolDetails = async () => {
    try {
      const response = await fetch(`/api/v1/tools/${slug}`);
      const data = await response.json();
      if (data.success) {
        setTool(data.tool);
      }
    } catch (error) {
      console.error('Error fetching tool:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildCommand = async () => {
    try {
      const response = await fetch(`/api/v1/tools/${slug}/build-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: { ...selectedParams, target } })
      });
      const data = await response.json();
      if (data.success) {
        setGeneratedCommand(data.command);
      }
    } catch (error) {
      console.error('Error building command:', error);
    }
  };

  const executeScan = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setScanRunning(true);
    setScanOutput('Starting scan...\n');

    try {
      const response = await fetch('/api/v1/scans/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tool_slug: slug,
          target,
          parameters: selectedParams
        })
      });
      const data = await response.json();
      
      if (data.success) {
        // Poll for results
        pollScanStatus(data.scan_id, token);
      } else {
        setScanOutput(`Error: ${data.error}`);
        setScanRunning(false);
      }
    } catch (error) {
      setScanOutput(`Error: ${error}`);
      setScanRunning(false);
    }
  };

  const pollScanStatus = async (scanId: string, token: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/scans/${scanId}/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
          setScanOutput(data.scan.output || 'Running...');
          
          if (data.scan.status !== 'running') {
            clearInterval(interval);
            setScanRunning(false);
            if (data.scan.error) {
              setScanOutput(prev => prev + `\n\nError: ${data.scan.error}`);
            }
          }
        }
      } catch (error) {
        clearInterval(interval);
        setScanRunning(false);
      }
    }, 2000);
  };

  const handleParamChange = (paramName: string, value: any, valueType: string) => {
    if (valueType === 'boolean') {
      setSelectedParams(prev => ({ ...prev, [paramName]: value }));
    } else {
      setSelectedParams(prev => ({ ...prev, [paramName]: value || undefined }));
    }
  };

  const applyPreset = (preset: any) => {
    setSelectedParams(preset.parameters);
  };

  useEffect(() => {
    if (target || Object.keys(selectedParams).length > 0) {
      buildCommand();
    }
  }, [selectedParams, target]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Tool Not Found</h1>
          <Link to="/tools" className="text-cyan-400 hover:underline">Back to Tools</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <div className="text-sm text-gray-400 mb-4">
            <Link to="/tools" className="hover:text-cyan-400">Tools</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-300">{tool.category}</span>
            <span className="mx-2">/</span>
            <span className="text-white">{tool.name}</span>
          </div>

          <div className="flex items-start gap-6">
            {/* Tool Icon */}
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-3xl font-bold shadow-lg shadow-cyan-500/20">
              {tool.name.charAt(0)}
            </div>

            {/* Tool Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold">{tool.name}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  tool.plan_required === 'starter' ? 'bg-green-500/20 text-green-400' :
                  tool.plan_required === 'professional' ? 'bg-cyan-500/20 text-cyan-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {tool.plan_required.toUpperCase()}
                </span>
                {tool.version && (
                  <span className="text-gray-500 text-sm">v{tool.version}</span>
                )}
              </div>
              <p className="text-xl text-gray-300 mb-4">{tool.description}</p>
              <div className="flex flex-wrap gap-2">
                {tool.tags?.map((tag: string) => (
                  <span key={tag} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-2">
              {tool.homepage && (
                <a href={tool.homepage} target="_blank" rel="noopener noreferrer"
                   className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2">
                  <span>🌐</span> Homepage
                </a>
              )}
              {tool.repository && (
                <a href={tool.repository} target="_blank" rel="noopener noreferrer"
                   className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2">
                  <span>📁</span> Repository
                </a>
              )}
              {tool.documentation_url && (
                <a href={tool.documentation_url} target="_blank" rel="noopener noreferrer"
                   className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2">
                  <span>📖</span> Docs
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700 bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1">
            {['overview', 'parameters', 'execute', 'examples', 'presets'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'text-cyan-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Description */}
              <section>
                <h2 className="text-2xl font-bold mb-4">Description</h2>
                <div className="prose prose-invert max-w-none">
                  <p className="text-gray-300 whitespace-pre-line leading-relaxed">
                    {tool.long_description || tool.description}
                  </p>
                </div>
              </section>

              {/* Installation */}
              {tool.installation && (
                <section>
                  <h2 className="text-2xl font-bold mb-4">Installation</h2>
                  <div className="bg-gray-800 rounded-lg p-4 font-mono">
                    <code className="text-green-400">$ {tool.installation}</code>
                  </div>
                </section>
              )}

              {/* Command Template */}
              {tool.command_template && (
                <section>
                  <h2 className="text-2xl font-bold mb-4">Basic Syntax</h2>
                  <div className="bg-gray-800 rounded-lg p-4 font-mono">
                    <code className="text-cyan-400">{tool.command_template}</code>
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Tool Info</h3>
                <dl className="space-y-3 text-sm">
                  {tool.author && (
                    <div className="flex justify-between">
                      <dt className="text-gray-400">Author</dt>
                      <dd className="text-white">{tool.author}</dd>
                    </div>
                  )}
                  {tool.license && (
                    <div className="flex justify-between">
                      <dt className="text-gray-400">License</dt>
                      <dd className="text-white">{tool.license}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Category</dt>
                    <dd className="text-white">{tool.category}</dd>
                  </div>
                  {tool.subcategory && (
                    <div className="flex justify-between">
                      <dt className="text-gray-400">Subcategory</dt>
                      <dd className="text-white">{tool.subcategory}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Parameters</dt>
                    <dd className="text-cyan-400 font-bold">{tool.parameter_count}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Presets</dt>
                    <dd className="text-cyan-400 font-bold">{tool.presets?.length || 0}</dd>
                  </div>
                </dl>
              </div>

              {/* Related Tools */}
              {tool.related_tools?.length > 0 && (
                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4">Related Tools</h3>
                  <div className="flex flex-wrap gap-2">
                    {tool.related_tools.map((related: string) => (
                      <Link
                        key={related}
                        to={`/tools/${related}`}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                      >
                        {related}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Parameters Tab */}
        {activeTab === 'parameters' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">All Parameters ({tool.parameter_count})</h2>
              <div className="text-sm text-gray-400">
                Every parameter is documented and executable
              </div>
            </div>

            {Object.entries(tool.parameters || {}).map(([category, params]: [string, any]) => (
              <section key={category} className="bg-gray-800 rounded-xl overflow-hidden">
                <div className="bg-gray-700/50 px-6 py-4 border-b border-gray-700">
                  <h3 className="text-lg font-semibold capitalize">
                    {category.replace(/_/g, ' ')}
                  </h3>
                </div>
                <div className="divide-y divide-gray-700">
                  {params.map((param: any, idx: number) => (
                    <div key={idx} className="p-6 hover:bg-gray-700/30 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {param.short_flag && (
                              <code className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded font-mono text-sm">
                                {param.short_flag}
                              </code>
                            )}
                            {param.long_flag && (
                              <code className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded font-mono text-sm">
                                {param.long_flag}
                              </code>
                            )}
                            <span className="text-white font-medium">{param.name}</span>
                            {param.required && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
                                Required
                              </span>
                            )}
                            <span className="px-2 py-0.5 bg-gray-600 text-gray-300 rounded text-xs">
                              {param.value_type}
                            </span>
                          </div>
                          <p className="text-gray-300 mb-2">{param.description}</p>
                          <div className="flex gap-4 text-sm text-gray-400">
                            {param.default_value !== null && param.default_value !== undefined && (
                              <span>Default: <code className="text-gray-300">{String(param.default_value)}</code></span>
                            )}
                            {param.example_value && (
                              <span>Example: <code className="text-cyan-400">{param.example_value}</code></span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Execute Tab */}
        {activeTab === 'execute' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Parameter Form */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Configure Scan</h2>

              {/* Target Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Target <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="e.g., 192.168.1.1 or example.com"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white"
                />
              </div>

              {/* Quick Presets */}
              {tool.presets?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Quick Presets</label>
                  <div className="flex flex-wrap gap-2">
                    {tool.presets.slice(0, 5).map((preset: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => applyPreset(preset)}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Parameter Inputs */}
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {Object.entries(tool.parameters || {}).map(([category, params]: [string, any]) => (
                  <div key={category}>
                    <h4 className="text-sm font-medium text-gray-400 mb-2 capitalize">
                      {category.replace(/_/g, ' ')}
                    </h4>
                    <div className="space-y-3">
                      {params.slice(0, 5).map((param: any, idx: number) => (
                        <div key={idx}>
                          {param.value_type === 'boolean' ? (
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedParams[param.name] || false}
                                onChange={(e) => handleParamChange(param.name, e.target.checked, 'boolean')}
                                className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
                              />
                              <span className="text-sm">
                                <code className="text-cyan-400">{param.short_flag || param.long_flag}</code>
                                <span className="text-gray-400 ml-2">{param.description.slice(0, 50)}...</span>
                              </span>
                            </label>
                          ) : (
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">
                                {param.short_flag || param.long_flag} - {param.name}
                              </label>
                              <input
                                type={param.value_type === 'integer' ? 'number' : 'text'}
                                value={selectedParams[param.name] || ''}
                                onChange={(e) => handleParamChange(param.name, e.target.value, param.value_type)}
                                placeholder={param.example_value || param.description.slice(0, 30)}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:border-cyan-500 text-white"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Generated Command */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Generated Command</label>
                <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <code className="text-green-400">$ {generatedCommand || `${tool.name.toLowerCase()} [options]`}</code>
                </div>
              </div>

              {/* Execute Button */}
              <button
                onClick={executeScan}
                disabled={!target || scanRunning}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  !target || scanRunning
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                }`}
              >
                {scanRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    Running Scan...
                  </span>
                ) : (
                  '🚀 Execute Scan'
                )}
              </button>
            </div>

            {/* Output */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Output</h2>
              <div className="bg-black rounded-xl p-4 h-[600px] overflow-y-auto font-mono text-sm">
                <pre className="text-green-400 whitespace-pre-wrap">
                  {scanOutput || '# Output will appear here after running a scan\n# Make sure to enter a target and click Execute'}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Examples Tab */}
        {activeTab === 'examples' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Usage Examples</h2>
            <div className="grid gap-4">
              {tool.examples?.map((example: any, idx: number) => (
                <div key={idx} className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-2">{example.title}</h3>
                  <p className="text-gray-400 mb-4">{example.description}</p>
                  <div className="bg-black rounded-lg p-4 font-mono flex items-center justify-between">
                    <code className="text-green-400">$ {example.command}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(example.command)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      📋
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Presets Tab */}
        {activeTab === 'presets' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Predefined Presets</h2>
            <p className="text-gray-400">Ready-to-use parameter combinations for common use cases</p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tool.presets?.map((preset: any, idx: number) => (
                <div key={idx} className="bg-gray-800 rounded-xl p-6 hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold">{preset.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs ${
                      preset.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400' :
                      preset.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {preset.difficulty}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">{preset.description}</p>
                  <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono mb-4">
                    {Object.entries(preset.parameters).map(([key, value]) => (
                      <div key={key} className="text-gray-300">
                        <span className="text-cyan-400">{key}:</span> {String(value)}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      applyPreset(preset);
                      setActiveTab('execute');
                    }}
                    className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-sm font-medium transition-colors"
                  >
                    Use This Preset →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolDetailPage;
