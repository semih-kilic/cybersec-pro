import { useNavigate } from 'react-router-dom';

interface QuickStartCardsProps {
  planType: string;
  toolsCount: number;
  scansToday: number;
  scansLimit: number;
  hasRunFirstScan: boolean;
}

export function QuickStartCards({
  planType,
  toolsCount,
  // scansToday, // Reserved for future usage display
  // scansLimit, // Reserved for future limit display
  hasRunFirstScan,
}: QuickStartCardsProps) {
  const navigate = useNavigate();

  const cards = [
    {
      id: 'first-scan',
      title: hasRunFirstScan ? 'New Scan' : 'Run Your First Scan',
      description: hasRunFirstScan 
        ? 'Start a new security scan' 
        : 'Begin with a quick Nmap port scan',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'cyan',
      bgGradient: 'from-cyan-500/20 to-blue-500/20',
      borderColor: 'border-cyan-500/30',
      action: () => navigate('/dashboard/scans/new'),
      primary: !hasRunFirstScan,
    },
    {
      id: 'browse-tools',
      title: 'Browse Tools',
      description: `Explore ${toolsCount} available security tools`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      color: 'purple',
      bgGradient: 'from-purple-500/20 to-violet-500/20',
      borderColor: 'border-purple-500/30',
      action: () => navigate('/dashboard/tools'),
      primary: false,
    },
    {
      id: 'view-reports',
      title: 'View Reports',
      description: 'Track vulnerabilities & scan history',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'green',
      bgGradient: 'from-green-500/20 to-emerald-500/20',
      borderColor: 'border-green-500/30',
      action: () => navigate('/dashboard/reports'),
      primary: false,
    },
  ];

  // Add upgrade card for trial/starter users
  if (planType === 'trial' || planType === 'starter') {
    cards.push({
      id: 'upgrade',
      title: 'Upgrade Plan',
      description: 'Get more tools & unlimited scans',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: 'yellow',
      bgGradient: 'from-yellow-500/20 to-orange-500/20',
      borderColor: 'border-yellow-500/30',
      action: () => navigate('/dashboard/upgrade'),
      primary: false,
    });
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span>🚀</span> Quick Start
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={card.action}
            className={`
              group relative p-5 rounded-xl border text-left transition-all duration-200
              bg-gradient-to-br ${card.bgGradient} ${card.borderColor}
              hover:scale-[1.02] hover:shadow-lg hover:shadow-${card.color}-500/10
              ${card.primary ? 'ring-2 ring-cyan-500/50' : ''}
            `}
          >
            {card.primary && (
              <span className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-semibold bg-cyan-500 text-white rounded-full">
                Start Here
              </span>
            )}
            
            <div className={`w-12 h-12 rounded-lg bg-${card.color}-500/20 flex items-center justify-center text-${card.color}-400 mb-3 group-hover:scale-110 transition`}>
              {card.icon}
            </div>
            
            <h4 className="font-semibold text-white mb-1">{card.title}</h4>
            <p className="text-sm text-gray-400">{card.description}</p>
            
            <div className={`mt-3 text-sm font-medium text-${card.color}-400 flex items-center gap-1 group-hover:gap-2 transition-all`}>
              Get Started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
