import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { 
  ShieldCheckIcon, 
  BoltIcon, 
  CloudIcon, 
  ChartBarIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowRightIcon 
} from '@heroicons/react/24/outline';
import './App.css';

// Components
const LandingPage = () => {
  const features = [
    {
      icon: ShieldCheckIcon,
      title: 'Advanced Security Testing',
      description: '165+ verified cybersecurity tools in one platform. From network scanning to web application testing.',
    },
    {
      icon: BoltIcon,
      title: 'Lightning Fast Execution',
      description: 'Cloud-powered infrastructure ensures rapid scan execution and real-time results delivery.',
    },
    {
      icon: CloudIcon,
      title: 'Cloud-Native Platform',
      description: 'Access your security tools from anywhere. No installation required, just login and start testing.',
    },
    {
      icon: ChartBarIcon,
      title: 'Comprehensive Reporting',
      description: 'Professional PDF reports, detailed analytics, and compliance-ready documentation.',
    },
    {
      icon: UserGroupIcon,
      title: 'Team Collaboration',
      description: 'Multi-user organizations, role-based access control, and shared scan results.',
    },
    {
      icon: CheckCircleIcon,
      title: 'Enterprise Ready',
      description: 'SOC2 compliant, 99.9% uptime SLA, and dedicated support for enterprise customers.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border border-gray-200 fixed w-full top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">CyberSec Pro</span>
            </div>
            <div className="md:flex items-center space-x-8" style={{display: 'none'}}>
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#tools" className="text-gray-600 hover:text-gray-900 transition-colors">Tools</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
              <button className="text-gray-600 hover:text-gray-900 transition-colors">Login</button>
              <button className="bg-blue-600 text-white px-4 py-4 rounded-lg hover:bg-blue-700 transition-colors">
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative hero pt-20 py-16">
        <div className="max-w-7xl mx-auto px-4 pt-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              World-Class
              <span className="text-blue-600"> Cybersecurity</span>
              <br />Testing Platform
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Access 165+ verified security tools through our cloud platform. 
              Professional penetration testing, vulnerability scanning, and security assessment tools 
              trusted by cybersecurity professionals worldwide.
            </p>
            
            <div className="flex flex-col gap-4 justify-center mb-12" style={{alignItems: 'center'}}>
              <button className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center">
                Start Free Trial
                <ArrowRightIcon className="ml-2 h-5" />
              </button>
              <button className="border border-gray-200 text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors">
                Watch Demo
              </button>
            </div>
            
            <div className="flex justify-center items-center gap-8 text-sm text-gray-500" style={{flexWrap: 'wrap'}}>
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 text-green-500 mr-2" />
                165+ Security Tools
              </div>
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 text-green-500 mr-2" />
                99.9% Uptime SLA
              </div>
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 text-green-500 mr-2" />
                SOC2 Compliant
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need for Security Testing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform combines the most powerful cybersecurity tools with modern cloud infrastructure 
              to deliver unparalleled testing capabilities.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="card hover:shadow-lg transition-shadow"
              >
                <feature.icon className="h-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Status */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="bg-green-100 border border-green-200 rounded-lg p-6" style={{display: 'inline-block'}}>
            <div className="flex items-center justify-center">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-3" style={{width: '12px', height: '12px'}}></div>
              <span className="text-green-800 font-semibold">🛡️ Enterprise SaaS Platform LIVE</span>
            </div>
            <p className="text-green-700 mt-2">World-class cybersecurity platform | Enterprise-grade architecture | Production ready</p>
          </div>
        </div>
      </section>

      {/* API Demo Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Live Enterprise API</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold mb-2">Enterprise API Status</h3>
              <p className="text-gray-600 mb-4">Check the health of our enterprise-grade API</p>
              <a 
                href="/api/v2/tools" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                Test Enterprise API
              </a>
            </div>
            <div className="card">
              <h3 className="text-lg font-semibold mb-2">Security Tools Catalog</h3>
              <p className="text-gray-600 mb-4">Browse 35+ enterprise security tools</p>
              <a 
                href="/api/v2/tools" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                View Tools Catalog
              </a>
            </div>
          </div>
          
          <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-center mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-3"></div>
              <span className="text-green-800 font-semibold">🚀 Enterprise Backend LIVE</span>
            </div>
            <p className="text-green-700">
              Enterprise API running on port 5002 | 35+ Security Tools | Multi-tenant Architecture
            </p>
            <p className="text-green-600 text-sm mt-2">
              Public URL: <a href="https://peterson-rfc-nick-where.trycloudflare.com" target="_blank" rel="noopener noreferrer" className="underline">https://peterson-rfc-nick-where.trycloudflare.com</a>
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <ShieldCheckIcon className="h-8 text-blue-400" />
              <span className="ml-2 text-xl font-bold">CyberSec Pro</span>
            </div>
            <p className="text-gray-400 mb-4">
              World-class cybersecurity testing platform trusted by professionals worldwide.
            </p>
            <p className="text-gray-500 text-sm">
              &copy; 2026 CyberSec Pro. All rights reserved. Built with ❤️ for cybersecurity professionals.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
