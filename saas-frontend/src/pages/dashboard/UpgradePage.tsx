import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToolCounts } from '../../hooks/useApiQueries';
import { useToast } from '../../components/ui/Toast';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';

function buildPlans(counts: { starter: number; professional: number; enterprise: number }) {
  return [
    {
      id: 'trial',
      name: 'Free Trial',
      price: 0,
      yearlyPrice: 0,
      period: '14 days',
      description: 'Test drive the platform',
      features: [
        '1 comprehensive security scan',
        'Full 682-test coverage',
        'PDF report with findings',
        'No credit card required',
      ],
      color: 'green',
      popular: false,
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 99,
      yearlyPrice: 990,
      period: '/month',
      description: 'For single website/app',
      features: [
        `${counts.starter} security tools`,
        '1 domain/application',
        'Weekly automated scans',
        'Email alerts for vulnerabilities',
        'PDF & HTML reports',
        'Priority email support (48h)',
        '3-month vulnerability history',
      ],
      color: 'blue',
      popular: false,
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 299,
      yearlyPrice: 2990,
      period: '/month',
      description: 'For growing SaaS & tech companies',
      features: [
        `${counts.professional} security tools`,
        'Up to 5 domains/applications',
        'Daily automated scans',
        'API access for CI/CD',
        'Slack / Teams / Email notifications',
        'Compliance reports (OWASP, GDPR)',
        'White-label PDF reports',
        'Priority support (24h)',
        '12-month vulnerability tracking',
      ],
      color: 'emerald',
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 799,
      yearlyPrice: 0, // Custom annual
      period: '/month',
      description: 'For security-conscious organizations',
      features: [
        `All ${counts.enterprise} security tools`,
        'Unlimited domains/applications',
        'Continuous monitoring (hourly)',
        'Dedicated account manager',
        'Custom compliance (PCI, HIPAA, SOC2)',
        'SSO / SAML / LDAP',
        'Unlimited users & team collaboration',
        'Advanced API (webhooks, integrations)',
        'SLA guarantee (99.9% uptime)',
        '24/7 priority support (2h response)',
        'Quarterly security roadmap reviews',
      ],
      color: 'purple',
      popular: false,
    },
  ];
}

export default function UpgradePage() {
  useDocumentTitle('Upgrade — CyberSec Pro');
  const { organization, token } = useAuth();
  const { t: _t } = useTranslation();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [pentestsPerYear, setPentestsPerYear] = useState(2);
  const [costPerPentest, setCostPerPentest] = useState(12000);
  const currentPlan = organization?.plan_type || 'starter';
  const toast = useToast();

  // Dynamic tool counts from API
  const { data: toolCounts } = useToolCounts();
  const plans = useMemo(() => buildPlans({
    starter: toolCounts?.plans?.starter ?? 50,
    professional: toolCounts?.plans?.professional ?? 200,
    enterprise: toolCounts?.plans?.enterprise ?? 682,
  }), [toolCounts]);

  const handleUpgrade = async (planId: string) => {
    if (planId === currentPlan) return;
    
    // Free trial doesn't need checkout
    if (planId === 'trial') return;
    
    // Enterprise -> Contact sales
    if (planId === 'enterprise') {
      window.open('/contact.html', '_blank');
      return;
    }
    
    setLoading(planId);
    
    try {
      // Call backend to create Stripe checkout session
      const response = await fetch('/api/v1/billing/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: planId,
          billing: billingCycle,
          success_url: `${window.location.origin}/dashboard/settings?tab=billing&success=true`,
          cancel_url: `${window.location.origin}/dashboard/upgrade`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
          return;
        }
      }
      
      // Fallback: use public endpoint
      const fallback = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, billing: billingCycle }),
      });
      if (fallback.ok) {
        const data = await fallback.json();
        if (data.url || data.checkout_url) {
          window.location.href = data.url || data.checkout_url;
          return;
        }
      }
      
      toast.error('Payment system is temporarily unavailable. Please contact cybersecpro@semihkilic.com for manual upgrade.');
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error('Connection error. Please try again or contact cybersecpro@semihkilic.com for assistance.');
    } finally {
      setLoading(null);
    }
  };

  const getButtonText = (planId: string) => {
    if (loading === planId) return 'Processing...';
    if (planId === currentPlan) return 'Current Plan';
    if (planId === 'enterprise') return 'Contact Sales';
    if (planId === 'trial') return 'Free Trial';
    const planLevels = ['trial', 'starter', 'professional', 'enterprise'];
    const currentLevel = planLevels.indexOf(currentPlan);
    const targetLevel = planLevels.indexOf(planId);
    if (targetLevel < currentLevel) return 'Downgrade';
    return 'Upgrade Now';
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green': return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'blue': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'emerald': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'purple': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
      default: return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };

  return (
    <PageTransition>
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">Upgrade Your Plan</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Unlock more tools, higher scan limits, and advanced features to supercharge your security testing.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full">
          <span className="text-gray-400">Current Plan:</span>
          <span className="text-emerald-400 font-semibold capitalize">{currentPlan}</span>
        </div>
        {/* Billing Cycle Toggle */}
        <div className="mt-6 inline-flex items-center gap-3 bg-gray-800/50 rounded-full p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${billingCycle === 'monthly' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${billingCycle === 'yearly' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Yearly <span className="text-green-400 text-xs ml-1">Save 17%</span>
          </button>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 items-stretch pt-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-gray-900 rounded-2xl p-6 border transition-all hover:scale-[1.02] flex flex-col ${
              plan.popular
                ? 'border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
                : plan.id === currentPlan
                ? 'border-green-500'
                : 'border-gray-800'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-[11px] font-bold rounded-full z-10 tracking-widest uppercase shadow-lg shadow-emerald-500/30 whitespace-nowrap">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                Most Popular
              </div>
            )}
            {plan.id === currentPlan && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-green-500 text-white text-xs font-bold rounded-full z-10 shadow-lg">
                ✓ Current Plan
              </div>
            )}

            <div className={`text-sm font-semibold uppercase tracking-wide mb-2 ${getColorClasses(plan.color).split(' ')[0]}`}>
              {plan.name}
            </div>

            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-4xl font-bold text-white">
                {plan.price === 0 ? '€0' : billingCycle === 'yearly' && plan.yearlyPrice > 0 ? `€${Math.round(plan.yearlyPrice / 12)}` : `€${plan.price}`}
              </span>
              <span className="text-gray-500">
                {plan.price === 0 ? plan.period : billingCycle === 'yearly' && plan.yearlyPrice > 0 ? '/mo billed annually' : '/month'}
              </span>
            </div>
            {billingCycle === 'yearly' && plan.yearlyPrice > 0 && (
              <p className="text-emerald-400 text-xs mb-2">€{plan.yearlyPrice}/year — save €{plan.price * 12 - plan.yearlyPrice}/year ({Math.round((1 - plan.yearlyPrice / (plan.price * 12)) * 100)}% off)</p>
            )}
            {plan.id === 'enterprise' && billingCycle === 'yearly' && (
              <p className="text-purple-400 text-xs mb-2">Custom annual pricing — contact sales</p>
            )}

            <p className="text-gray-400 text-sm mb-6">{plan.description}</p>

            <ul className="space-y-3 mb-6 flex-grow">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${getColorClasses(plan.color).split(' ')[0]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={plan.id === currentPlan}
                className={`w-full py-3 rounded-xl font-semibold transition ${
                  plan.id === currentPlan
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : plan.id === 'trial'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
                    : plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                    : plan.id === 'starter'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30'
                    : plan.id === 'enterprise'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold hover:from-purple-400 hover:to-pink-400 shadow-lg shadow-purple-500/30'
                    : `${getColorClasses(plan.color)} border hover:opacity-80`
                }`}
              >
                {getButtonText(plan.id)}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ROI Calculator */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-2xl p-8 border border-emerald-500/20 mb-12">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">ROI Calculator</h2>
            <p className="text-gray-400 text-sm mb-6">See how much you save compared to traditional penetration testing.</p>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Pentests per year</label>
                <input type="range" min={1} max={6} value={pentestsPerYear} onChange={(e) => setPentestsPerYear(Number(e.target.value))} className="w-full accent-emerald-500" />
                <div className="flex justify-between text-xs text-gray-500 mt-1"><span>1</span><span className="text-emerald-400 font-bold">{pentestsPerYear}</span><span>6</span></div>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Average cost per pentest (€)</label>
                <input type="range" min={5000} max={25000} step={1000} value={costPerPentest} onChange={(e) => setCostPerPentest(Number(e.target.value))} className="w-full accent-emerald-500" />
                <div className="flex justify-between text-xs text-gray-500 mt-1"><span>€5K</span><span className="text-emerald-400 font-bold">€{costPerPentest.toLocaleString()}</span><span>€25K</span></div>
              </div>
            </div>
          </div>
          <div className="bg-gray-900/80 rounded-xl p-6 border border-gray-700">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Traditional pentests</span>
                <span className="text-red-400 font-bold text-lg">€{(pentestsPerYear * costPerPentest).toLocaleString()}/year</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">CyberSec Pro (Professional)</span>
                <span className="text-emerald-400 font-bold text-lg">€3,588/year</span>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold">Your savings</span>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold text-2xl">€{Math.max(0, pentestsPerYear * costPerPentest - 3588).toLocaleString()}</span>
                    <span className="text-emerald-400 text-sm ml-1">/ year</span>
                  </div>
                </div>
                <div className="mt-2 w-full bg-gray-800 rounded-full h-3">
                  <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all" style={{ width: `${Math.min(100, Math.round((1 - 3588 / (pentestsPerYear * costPerPentest)) * 100))}%` }} />
                </div>
                <p className="text-emerald-400 font-medium text-sm mt-2">{Math.round((1 - 3588 / (pentestsPerYear * costPerPentest)) * 100)}% cost reduction</p>
              </div>
              <p className="text-gray-500 text-xs">Plus: continuous monitoring, automated scans, real-time alerts — not just point-in-time testing.</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
        <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              q: 'How do I upgrade my plan?',
              a: 'Click the "Upgrade Now" button on your desired plan. You\'ll be redirected to our secure payment processor to complete the upgrade.',
            },
            {
              q: 'Can I downgrade my plan?',
              a: 'Yes, you can downgrade at any time. Your new plan will take effect at the start of your next billing cycle.',
            },
            {
              q: 'What payment methods do you accept?',
              a: 'We accept all major credit cards (Visa, MasterCard, Amex), PayPal, and bank transfers for Enterprise plans.',
            },
            {
              q: 'Is there a money-back guarantee?',
              a: 'Yes! We offer a 30-day money-back guarantee. If you\'re not satisfied, contact us for a full refund.',
            },
          ].map((faq, i) => (
            <div key={i} className="p-4 bg-gray-800/50 rounded-lg">
              <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
              <p className="text-gray-400 text-sm">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Back Link */}
      <div className="mt-8 text-center">
        <Link to="/dashboard/settings" className="text-emerald-400 hover:underline">
          ← Back to Settings
        </Link>
      </div>
    </div>
    </PageTransition>
  );
}
