import React, { useState, useEffect } from 'react';
import { 
  Shield, Search, Download, CheckCircle, AlertCircle,
  Wifi, Globe, Lock, Database, Terminal, Bug, Key,
  Eye, Code, Server, Radio, FileSearch, Cpu, Play,
  ChevronRight, Clock, Zap, Info, Copy, X, Settings,
  BookOpen, Target
} from 'lucide-react';
import axios from 'axios';
import { apiUrl } from '../config/api';

interface Tool {
  id: number;
  name: string;
  category: string;
  description: string;
  installed: boolean;
  command: string;
  difficulty?: string;
  requires_sudo?: boolean;
}

interface Preset {
  name: string;
  description: string;
  command: string;
  time: string;
  difficulty: string;
  requires_sudo?: boolean;
}

interface Parameter {
  name: string;
  description: string;
  required: boolean;
  example?: string;
}

interface Example {
  description: string;
  command: string;
}

interface InstallationInfo {
  reason: string;
  install_command: string;
  install_type: string;
  note: string;
}

interface ToolDetails extends Tool {
  description_full?: string;
  presets?: Preset[];
  parameters?: Parameter[];
  examples?: Example[];
  installation_info?: InstallationInfo;
}

interface Category {
  name: string;
  count: number;
  icon: React.ReactNode;
}

interface TaskGroup {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  categories: string[];
  keywords: string[];
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Information Gathering': <Search className="w-5 h-5" />,
  'Vulnerability Analysis': <Bug className="w-5 h-5" />,
  'Web Application Analysis': <Globe className="w-5 h-5" />,
  'Password Attacks': <Key className="w-5 h-5" />,
  'Wireless Attacks': <Wifi className="w-5 h-5" />,
  'Exploitation Tools': <Terminal className="w-5 h-5" />,
  'Sniffing & Spoofing': <Eye className="w-5 h-5" />,
  'Post Exploitation': <Server className="w-5 h-5" />,
  'Forensics': <FileSearch className="w-5 h-5" />,
  'Reverse Engineering': <Code className="w-5 h-5" />,
  'Stress Testing': <Cpu className="w-5 h-5" />,
  'Hardware Hacking': <Radio className="w-5 h-5" />,
  'Reporting Tools': <Database className="w-5 h-5" />,
  'Social Engineering': <Lock className="w-5 h-5" />,
};

const DIFFICULTY_COLORS: Record<string, string> = {
  'beginner': 'bg-green-500/20 text-green-400 border-green-500/30',
  'intermediate': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'advanced': 'bg-red-500/20 text-red-400 border-red-500/30',
};

const TASK_GROUPS: TaskGroup[] = [
  {
    id: 'recon',
    name: 'Recon & Discovery',
    description: 'Discover hosts, subdomains, and services.',
    icon: <Search className="w-5 h-5" />,
    categories: ['Information Gathering', 'Sniffing & Spoofing'],
    keywords: ['recon', 'enumeration', 'discover', 'whois', 'dns', 'subdomain', 'scan']
  },
  {
    id: 'web',
    name: 'Web Security',
    description: 'Test web apps and APIs.',
    icon: <Globe className="w-5 h-5" />,
    categories: ['Web Application Analysis', 'Vulnerability Analysis'],
    keywords: ['web', 'http', 'api', 'sql', 'xss', 'csrf', 'vuln']
  },
  {
    id: 'network',
    name: 'Network & Ports',
    description: 'Map networks and open ports.',
    icon: <Server className="w-5 h-5" />,
    categories: ['Information Gathering', 'Sniffing & Spoofing', 'Stress Testing'],
    keywords: ['network', 'port', 'tcp', 'udp', 'arp', 'sniff']
  },
  {
    id: 'passwords',
    name: 'Password & Auth',
    description: 'Audit and recover credentials.',
    icon: <Key className="w-5 h-5" />,
    categories: ['Password Attacks'],
    keywords: ['password', 'hash', 'crack', 'brute', 'auth']
  },
  {
    id: 'wireless',
    name: 'Wireless',
    description: 'Test Wi‑Fi security.',
    icon: <Wifi className="w-5 h-5" />,
    categories: ['Wireless Attacks'],
    keywords: ['wifi', 'wireless', 'wpa', 'wpa2', 'wpa3', 'handshake']
  },
  {
    id: 'exploit',
    name: 'Exploitation',
    description: 'Exploit and validate issues.',
    icon: <Bug className="w-5 h-5" />,
    categories: ['Exploitation Tools', 'Post Exploitation'],
    keywords: ['exploit', 'payload', 'shell', 'metasploit']
  },
  {
    id: 'forensics',
    name: 'Forensics',
    description: 'Analyze disks and memory.',
    icon: <FileSearch className="w-5 h-5" />,
    categories: ['Forensics'],
    keywords: ['forensics', 'memory', 'disk', 'image', 'artifact']
  },
  {
    id: 'reverse',
    name: 'Reverse Engineering',
    description: 'Analyze binaries and malware.',
    icon: <Code className="w-5 h-5" />,
    categories: ['Reverse Engineering'],
    keywords: ['reverse', 'binary', 'malware', 'disassembly']
  },
  {
    id: 'reporting',
    name: 'Reporting',
    description: 'Export and organize results.',
    icon: <Database className="w-5 h-5" />,
    categories: ['Reporting Tools'],
    keywords: ['report', 'export', 'pdf', 'html']
  },
  {
    id: 'social',
    name: 'Social Engineering',
    description: 'Phishing and awareness tests.',
    icon: <Lock className="w-5 h-5" />,
    categories: ['Social Engineering'],
    keywords: ['phishing', 'social', 'email', 'osint']
  }
];

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [installingTool, setInstallingTool] = useState<number | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  const [commandOutput, setCommandOutput] = useState<string>('');

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      const response = await axios.get(apiUrl('/api/tools'));
      setTools(response.data.tools || []);
      
      const categoryMap = new Map<string, number>();
      (response.data.tools || []).forEach((tool: Tool) => {
        categoryMap.set(tool.category, (categoryMap.get(tool.category) || 0) + 1);
      });
      
      const cats: Category[] = Array.from(categoryMap.entries()).map(([name, count]) => ({
        name,
        count,
        icon: CATEGORY_ICONS[name] || <Shield className="w-5 h-5" />
      }));
      
      setCategories(cats.sort((a, b) => b.count - a.count));
    } catch (error) {
      console.error('Failed to load tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadToolDetails = async (toolId: number) => {
    setLoadingDetails(true);
    try {
      const response = await axios.get(apiUrl(`/api/tools/${toolId}/details`));
      setSelectedTool(response.data);
    } catch (error) {
      console.error('Failed to load tool details:', error);
      const tool = tools.find(t => t.id === toolId);
      if (tool) {
        setSelectedTool({
          ...tool,
          presets: [{
            name: 'Basic Run',
            description: `Run ${tool.name} with default options`,
            command: tool.command || `${tool.name.toLowerCase()} {target}`,
            time: 'Varies',
            difficulty: 'beginner'
          }],
          parameters: [
            { name: 'target', description: 'Target IP, hostname, or URL', required: true, example: '10.0.0.115' }
          ]
        });
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleInstall = async (toolId: number, toolName: string) => {
    setInstallingTool(toolId);
    try {
      await axios.post(apiUrl(`/api/tools/${toolId}/install`));
      alert(`✅ ${toolName} installed successfully!`);
      loadTools();
      if (selectedTool?.id === toolId) {
        loadToolDetails(toolId);
      }
    } catch (error: any) {
      alert(`❌ Installation failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setInstallingTool(null);
    }
  };

  const handleRunPreset = (preset: Preset) => {
    setSelectedPreset(preset);
    setShowRunModal(true);
    setTargetInput('');
    setCommandOutput('');
  };

  const executeCommand = async () => {
    if (!selectedPreset || !targetInput) return;
    if (!selectedTool?.id) {
      setCommandOutput('❌ Error: Tool not selected.');
      return;
    }
    
    let command = selectedPreset.command;
    command = command.replace('{target}', targetInput);
    command = command.replace('{port}', '80');
    command = command.replace('{interface}', 'eth0');
    
    setRunningCommand(command);
    setCommandOutput('Starting scan...\n');
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const createResponse = await axios.post(apiUrl('/api/scans'), {
        name: `${selectedTool?.name} - ${selectedPreset.name}`,
        target: targetInput,
        tool_id: selectedTool.id,
        scan_type: selectedPreset.name
      }, { headers });

      const scanId = createResponse.data?.scan?.id || createResponse.data?.id;
      if (!scanId) {
        setCommandOutput(prev => prev + '\n❌ Error: Scan ID missing from response.');
        return;
      }

      await axios.post(apiUrl(`/api/scans/${scanId}/execute`), null, { headers });

      setCommandOutput(prev => prev + `\n✅ Scan started successfully!\n\nScan ID: ${scanId}\nCommand: ${command}\n\nGo to Scans page to see results.`);
    } catch (error: any) {
      setCommandOutput(prev => prev + `\n❌ Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setRunningCommand(null);
    }
  };

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
  };

  const filteredTools = tools.filter(tool => {
    const matchesCategory = selectedCategory === 'all' || 
                           (selectedCategory === 'installed' && tool.installed) ||
                           (selectedCategory === 'not-installed' && !tool.installed) ||
                           tool.category === selectedCategory;
    const task = TASK_GROUPS.find(group => group.id === selectedTask);
    const toolText = `${tool.name} ${tool.description} ${tool.category}`.toLowerCase();
    const matchesTask = selectedTask === 'all' || (task ? (
      task.categories.includes(tool.category) ||
      task.keywords.some(keyword => toolText.includes(keyword))
    ) : true);
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesTask && matchesSearch;
  });

  const installedCount = tools.filter(t => t.installed).length;
  const notInstalledCount = tools.length - installedCount;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl gradient-text animate-pulse">Loading tools...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Categories Sidebar */}
      <div className="w-72 glass border-r border-dark-border p-4 overflow-y-auto">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Target className="text-primary" />
          Tasks
        </h2>

        <button
          onClick={() => setSelectedTask('all')}
          className={`w-full text-left p-3 rounded-lg mb-2 transition-all cursor-pointer ${
            selectedTask === 'all'
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'hover:bg-white/5 text-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5" />
              <span>All Tasks</span>
            </div>
            <span className="text-xs text-gray-400">{tools.length}</span>
          </div>
        </button>

        {TASK_GROUPS.map(group => {
          const count = tools.filter(tool =>
            group.categories.includes(tool.category) ||
            group.keywords.some(keyword => `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(keyword))
          ).length;

          return (
            <button
              key={group.id}
              onClick={() => setSelectedTask(group.id)}
              className={`w-full text-left p-3 rounded-lg mb-2 transition-all cursor-pointer ${
                selectedTask === group.id
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'hover:bg-white/5 text-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {group.icon}
                  <span>{group.name}</span>
                </div>
                <span className="text-xs text-gray-400">{count}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{group.description}</div>
            </button>
          );
        })}

        <h2 className="text-lg font-bold text-white mb-4 mt-6 flex items-center gap-2">
          <Shield className="text-primary" />
          Categories
        </h2>
        
        <button
          onClick={() => setSelectedCategory('all')}
          className={`w-full text-left p-3 rounded-lg mb-2 transition-all cursor-pointer ${
            selectedCategory === 'all' 
              ? 'bg-gradient-to-r from-primary to-secondary text-dark-bg font-bold' 
              : 'text-gray-400 hover:bg-dark-bg/50 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span>All Tools</span>
            <span className="text-sm">{tools.length}</span>
          </div>
        </button>
        
        <button
          onClick={() => setSelectedCategory('installed')}
          className={`w-full text-left p-3 rounded-lg mb-2 transition-all cursor-pointer ${
            selectedCategory === 'installed' 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-dark-bg font-bold' 
              : 'text-gray-400 hover:bg-dark-bg/50 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Installed
            </span>
            <span className="text-sm">{installedCount}</span>
          </div>
        </button>

        <button
          onClick={() => setSelectedCategory('not-installed')}
          className={`w-full text-left p-3 rounded-lg mb-4 transition-all cursor-pointer ${
            selectedCategory === 'not-installed' 
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-dark-bg font-bold' 
              : 'text-gray-400 hover:bg-dark-bg/50 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Not Installed
            </span>
            <span className="text-sm">{notInstalledCount}</span>
          </div>
        </button>
        
        <div className="border-t border-dark-border pt-4 space-y-1">
          {categories.map(cat => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`w-full text-left p-3 rounded-lg transition-all cursor-pointer ${
                selectedCategory === cat.name 
                  ? 'bg-primary/20 text-primary border border-primary/30' 
                  : 'text-gray-400 hover:bg-dark-bg/50 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  {cat.icon}
                  {cat.name}
                </span>
                <span className="text-xs">{cat.count}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Tools List */}
        <div className={`${selectedTool ? 'w-1/2' : 'w-full'} p-6 overflow-y-auto transition-all`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Security Tools</h1>
              <p className="text-gray-400">
                {selectedCategory === 'all' ? 'All tools' : 
                 selectedCategory === 'installed' ? 'Installed tools' :
                 selectedCategory === 'not-installed' ? 'Not installed tools' : selectedCategory}
                {' • '}{filteredTools.length} tools
              </p>
            </div>
            
            {/* Search */}
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools..."
                className="w-full pl-10 pr-4 py-3 bg-dark-bg text-white rounded-xl border border-dark-border focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-primary">{installedCount}</div>
              <div className="text-sm text-gray-400">Installed & Ready</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-orange-400">{notInstalledCount}</div>
              <div className="text-sm text-gray-400">Available to Install</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{categories.length}</div>
              <div className="text-sm text-gray-400">Categories</div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="glass rounded-xl p-4 mb-6 border border-primary/30 bg-primary/5">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-bold text-white mb-1">How to Use Tools</h3>
                <p className="text-sm text-gray-400">
                  Click on any tool to see detailed information, presets, and run options. 
                  Green tools are installed and ready to use. Click "Install" on gray tools to install them.
                </p>
              </div>
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredTools.map((tool) => (
              <div
                key={tool.id}
                onClick={() => loadToolDetails(tool.id)}
                className={`glass rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] ${
                  selectedTool?.id === tool.id ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${tool.installed ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {CATEGORY_ICONS[tool.category] || <Shield className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        {tool.name}
                        {tool.installed && <CheckCircle className="w-4 h-4 text-green-400" />}
                      </h3>
                      <p className="text-xs text-gray-500">{tool.category}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
                
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                  {tool.description || 'Click to see details and run options'}
                </p>
                
                <div className="flex items-center justify-between">
                  <code className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                    {tool.command || tool.name.toLowerCase()}
                  </code>
                  
                  {tool.installed ? (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <Zap className="w-3 h-3" /> Ready
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInstall(tool.id, tool.name);
                      }}
                      disabled={installingTool === tool.id}
                      className="flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-all text-sm cursor-pointer disabled:opacity-50"
                    >
                      {installingTool === tool.id ? (
                        <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Install
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredTools.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No tools found</p>
              <p className="text-sm">Try a different search or category</p>
            </div>
          )}
        </div>

        {/* Tool Details Panel */}
        {selectedTool && (
          <div className="w-1/2 border-l border-dark-border bg-dark-bg/50 overflow-y-auto">
            {loadingDetails ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${selectedTool.installed ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {CATEGORY_ICONS[selectedTool.category] || <Shield className="w-8 h-8" />}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        {selectedTool.name}
                        {selectedTool.installed && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                            Installed
                          </span>
                        )}
                      </h2>
                      <p className="text-gray-400">{selectedTool.category}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTool(null)}
                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-border cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Description */}
                <div className="glass rounded-xl p-4 mb-6">
                  <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    About This Tool
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {selectedTool.description_full || selectedTool.description || 'No description available'}
                  </p>
                </div>

                {/* Installation Status */}
                {!selectedTool.installed && (
                  <div className="glass rounded-xl p-4 mb-6 border border-orange-500/30 bg-orange-500/5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-orange-400" />
                        <div>
                          <h3 className="font-bold text-white">Not Installed</h3>
                          <p className="text-sm text-gray-400">Install this tool to use it</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleInstall(selectedTool.id, selectedTool.name)}
                        disabled={installingTool === selectedTool.id}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-dark-bg font-bold rounded-lg hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {installingTool === selectedTool.id ? (
                          <div className="animate-spin w-5 h-5 border-2 border-dark-bg border-t-transparent rounded-full" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                        Install Now
                      </button>
                    </div>
                    
                    {/* Installation Info */}
                    {selectedTool.installation_info && (
                      <div className="border-t border-orange-500/20 pt-4 mt-4">
                        <div className="space-y-3">
                          <div>
                            <span className="text-xs text-orange-400 font-medium">Why not installed:</span>
                            <p className="text-sm text-gray-300">{selectedTool.installation_info.reason}</p>
                          </div>
                          <div>
                            <span className="text-xs text-orange-400 font-medium">Manual install command:</span>
                            <code className="block mt-1 text-sm text-green-400 bg-dark-bg px-3 py-2 rounded-lg font-mono">
                              {selectedTool.installation_info.install_command}
                            </code>
                          </div>
                          <div>
                            <span className="text-xs text-orange-400 font-medium">Note:</span>
                            <p className="text-sm text-gray-400">{selectedTool.installation_info.note}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Presets - Easy Run Options */}
                {selectedTool.presets && selectedTool.presets.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Quick Scan Presets
                      <span className="text-xs text-gray-500 font-normal">- Click to run</span>
                    </h3>
                    <div className="space-y-3">
                      {selectedTool.presets.map((preset, idx) => (
                        <div
                          key={idx}
                          className="glass rounded-xl p-4 hover:border-primary/50 transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-bold text-white flex items-center gap-2">
                                {preset.name}
                                {preset.requires_sudo && (
                                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                                    sudo
                                  </span>
                                )}
                              </h4>
                              <p className="text-sm text-gray-400">{preset.description}</p>
                            </div>
                            <div className={`text-xs px-2 py-1 rounded border ${DIFFICULTY_COLORS[preset.difficulty] || DIFFICULTY_COLORS['beginner']}`}>
                              {preset.difficulty}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="text-xs text-gray-500">{preset.time}</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <code className="text-xs text-primary bg-primary/10 px-2 py-1 rounded flex-1 mr-2 overflow-hidden text-ellipsis">
                              {preset.command}
                            </code>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => copyCommand(preset.command)}
                                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-border cursor-pointer"
                                title="Copy command"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              {selectedTool.installed && (
                                <button
                                  onClick={() => handleRunPreset(preset)}
                                  className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-all cursor-pointer"
                                >
                                  <Play className="w-4 h-4" />
                                  Run
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parameters */}
                {selectedTool.parameters && selectedTool.parameters.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-primary" />
                      Parameters & Options
                    </h3>
                    <div className="glass rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-dark-border/50">
                          <tr>
                            <th className="text-left p-3 text-gray-400 font-medium">Parameter</th>
                            <th className="text-left p-3 text-gray-400 font-medium">Description</th>
                            <th className="text-left p-3 text-gray-400 font-medium">Example</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTool.parameters.map((param, idx) => (
                            <tr key={idx} className="border-t border-dark-border">
                              <td className="p-3">
                                <code className="text-primary">{param.name}</code>
                                {param.required && (
                                  <span className="text-red-400 ml-1">*</span>
                                )}
                              </td>
                              <td className="p-3 text-gray-400">{param.description}</td>
                              <td className="p-3">
                                {param.example && (
                                  <code className="text-xs bg-dark-border px-2 py-1 rounded text-gray-300">
                                    {param.example}
                                  </code>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Examples */}
                {selectedTool.examples && selectedTool.examples.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-green-400" />
                      Example Commands
                    </h3>
                    <div className="space-y-2">
                      {selectedTool.examples.map((example, idx) => (
                        <div key={idx} className="glass rounded-lg p-3">
                          <p className="text-sm text-gray-400 mb-1">{example.description}</p>
                          <div className="flex items-center justify-between">
                            <code className="text-sm text-green-400 font-mono">{example.command}</code>
                            <button
                              onClick={() => copyCommand(example.command)}
                              className="p-1 text-gray-400 hover:text-white cursor-pointer"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Run Modal */}
      {showRunModal && selectedPreset && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-dark-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Play className="w-5 h-5 text-green-400" />
                    Run {selectedTool?.name}
                  </h2>
                  <p className="text-gray-400">{selectedPreset.name}</p>
                </div>
                <button
                  onClick={() => setShowRunModal(false)}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-border cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Target className="w-4 h-4 inline mr-1" />
                  Target (IP, hostname, or URL)
                </label>
                <input
                  type="text"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="e.g., 10.0.0.115, example.com, http://target.com"
                  className="w-full px-4 py-3 bg-dark-bg text-white rounded-xl border border-dark-border focus:border-primary outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Command to Execute
                </label>
                <div className="bg-dark-bg rounded-xl p-4 border border-dark-border">
                  <code className="text-green-400 font-mono text-sm">
                    {selectedPreset.command.replace('{target}', targetInput || '{target}')}
                  </code>
                </div>
              </div>
              
              {commandOutput && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Output
                  </label>
                  <div className="bg-black rounded-xl p-4 border border-dark-border max-h-60 overflow-y-auto">
                    <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                      {commandOutput}
                    </pre>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowRunModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-border cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={executeCommand}
                  disabled={!targetInput || runningCommand !== null}
                  className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {runningCommand ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Start Scan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
