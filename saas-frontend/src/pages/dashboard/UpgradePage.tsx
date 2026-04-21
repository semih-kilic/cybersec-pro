import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useToolCounts, useCreateCheckout } from '../../hooks/useApiQueries';
import { useToast } from '../../components/ui/Toast';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';

function buildPlans(counts: { trial: number; starter: number; professional: number; enterprise: number }) {
  return [
    {
      id: 'trial',
      name: 'Free Trial',
      price: 0,
      yearlyPrice: 0,
      period: '14 days',
      description: 'Test drive the platform',
      features: [
        `All ${counts.trial} security tools`,
        '3 scans per day',
        '1 concurrent scan',
        'PDF report with findings',
        'Email support',
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
        `All ${counts.starter} security tools`,
        '30 scans per month',
        '2 concurrent scans',
        '1 domain/application',
        'PDF & HTML reports',
        'Scheduled scans',
        'Priority email support (48h)',
        '3 team members',
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
        `All ${counts.professional} security tools`,
        '250 scans per month',
        '5 concurrent scans',
        'Up to 5 domains/applications',
        'API access for CI/CD',
        'Slack / Teams / Email notifications',
        'Compliance reports (NIST, OWASP, GDPR, PCI DSS, HIPAA, SOC 2)',
        'White-label PDF reports with company logo',
        'LDAP / Active Directory scan',
        'Priority support (24h)',
        '10 team members',
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
        '5,000 scans per month',
        'Unlimited concurrent scans',
        'Unlimited domains/applications',
        'Continuous monitoring (hourly)',
        'Dedicated account manager',
        'All compliance frameworks (NIST, OWASP, GDPR, PCI DSS, HIPAA, SOC 2)',
        'White-label reports with company logo',
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
  const { organization } = useAuth();
  const { t } = useTranslation();
  const checkoutMutation = useCreateCheckout();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [pentestsPerYear, setPentestsPerYear] = useState(2);
  const [costPerPentest, setCostPerPentest] = useState(12000);
  const currentPlan = organization?.plan_type || 'starter';
  const toast = useToast();

  // Dynamic tool counts from API
  const { data: toolCounts } = useToolCounts();
  const totalToolsFallback = toolCounts?.total ?? 396;
  const plans = useMemo(() => buildPlans({
    trial: toolCounts?.plans?.trial ?? totalToolsFallback,
    starter: toolCounts?.plans?.starter ?? totalToolsFallback,
    professional: toolCounts?.plans?.professional ?? totalToolsFallback,
    enterprise: toolCounts?.plans?.enterprise ?? totalToolsFallback,
  }), [toolCounts]);

  const handleUpgrade = async (planId: string) => {
    if (planId === currentPlan) return;
    
    // Free trial doesn't need checkout
    if (planId === 'trial') return;
    
    // Enterprise -> offer both checkout and contact options
    if (planId === 'enterprise') {
      setLoading(planId);
      try {
        const checkoutData = { plan: planId, billing: billingCycle };
        const data: any = await checkoutMutation.mutateAsync(checkoutData);
        if (data.checkout_url || data.url) {
          window.location.href = data.checkout_url || data.url;
          return;
        }
        toast.success('For Enterprise activation, contact cybersecpro@semihkilic.com or use the checkout link above.');
      } catch {
        toast.success('Enterprise plan available! Contact cybersecpro@semihkilic.com for activation or custom pricing.');
      } finally {
        setLoading(null);
      }
      return;
    }
    
    setLoading(planId);
    
    try {
      const checkoutData = {
        plan: planId,
        billing: billingCycle,
      };
      const data: any = await checkoutMutation.mutateAsync(checkoutData);
      
      if (data.checkout_url || data.url) {
        window.location.href = data.checkout_url || data.url;
        return;
      }
      
      // Stripe not configured yet — show contact info
      toast.success('Please contact cybersecpro@semihkilic.com to upgrade your plan. We will assist you personally!');
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || '';
      if (msg.includes('not configured') || msg.includes('Stripe')) {
        toast.success('Please contact cybersecpro@semihkilic.com to upgrade your plan. We will assist you personally!');
      } else {
        toast.error('Connection error. Please try again or contact cybersecpro@semihkilic.com for assistance.');
      }
    } finally {
      setLoading(null);
    }
  };

  const getButtonText = (planId: string) => {
    if (loading === planId) return 'Processing...';
    if (planId === currentPlan) return 'Current Plan';
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
    <div className="p-6 max-w-7xl mx-auto bg-zinc-950 border-2 border-zinc-800">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">{t('upgrade.title')}</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          {t('upgrade.subtitle')}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700">
          <span className="text-gray-400">{t('upgrade.currentPlan')}:</span>
          <span className="text-emerald-400 font-semibold capitalize">{currentPlan}</span>
        </div>
        {/* Billing Cycle Toggle */}
        <div className="mt-6 inline-flex items-center gap-3 bg-zinc-900 border border-zinc-700 p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 text-sm font-semibold transition ${billingCycle === 'monthly' ? 'bg-lime-400 text-black' : 'text-gray-400 hover:text-white'}`}
          >
            {t('upgrade.monthly')}
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2 text-sm font-semibold transition ${billingCycle === 'yearly' ? 'bg-lime-400 text-black' : 'text-gray-400 hover:text-white'}`}
          >
            {t('upgrade.yearly')} <span className="text-green-400 text-xs ml-1">{t('upgrade.savePercent')}</span>
          </button>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 items-stretch pt-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-zinc-900 p-6 border-2 transition-all hover:-translate-y-1 flex flex-col ${
              plan.popular
                ? 'border-lime-400 shadow-lg shadow-lime-400/10'
                : plan.id === currentPlan
                ? 'border-lime-500'
                : 'border-gray-800'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-4 py-1.5 bg-lime-400 text-black text-[11px] font-bold z-10 tracking-widest uppercase whitespace-nowrap border border-lime-300">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                {t('upgrade.popular')}
              </div>
            )}
            {plan.id === currentPlan && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-lime-500 text-black text-xs font-bold z-10 border border-lime-300">
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
              <p className="text-purple-400 text-xs mb-2">{t('upgrade.customPricing', 'Custom annual pricing — contact sales')}</p>
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
            <h2 className="text-2xl font-bold text-white mb-2">{t('upgrade.roiCalculator', 'ROI Calculator')}</h2>
            <p className="text-gray-400 text-sm mb-6">{t('upgrade.roiDesc', 'See how much you save compared to traditional penetration testing.')}</p>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">{t('upgrade.pentestsPerYear', 'Pentests per year')}</label>
                <input type="range" min={1} max={6} value={pentestsPerYear} onChange={(e) => setPentestsPerYear(Number(e.target.value))} className="w-full accent-emerald-500" />
                <div className="flex justify-between text-xs text-gray-500 mt-1"><span>1</span><span className="text-emerald-400 font-bold">{pentestsPerYear}</span><span>6</span></div>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">{t('upgrade.avgCostPerPentest', 'Average cost per pentest (€)')}</label>
                <input type="range" min={5000} max={25000} step={1000} value={costPerPentest} onChange={(e) => setCostPerPentest(Number(e.target.value))} className="w-full accent-emerald-500" />
                <div className="flex justify-between text-xs text-gray-500 mt-1"><span>€5K</span><span className="text-emerald-400 font-bold">€{costPerPentest.toLocaleString()}</span><span>€25K</span></div>
              </div>
            </div>
          </div>
          <div className="bg-gray-900/80 rounded-xl p-6 border border-gray-700">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">{t('upgrade.traditionalPentests', 'Traditional pentests')}</span>
                <span className="text-red-400 font-bold text-lg">€{(pentestsPerYear * costPerPentest).toLocaleString()}/year</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">{t('upgrade.cybersecPro', 'CyberSec Pro (Professional)')}</span>
                <span className="text-emerald-400 font-bold text-lg">€3,588/year</span>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold">{t('upgrade.yourSavings', 'Your savings')}</span>
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
              <p className="text-gray-500 text-xs">{t('upgrade.plusDesc', 'Plus: continuous monitoring, automated scans, real-time alerts — not just point-in-time testing.')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
        <h2 className="text-2xl font-bold text-white mb-6">{t('upgrade.faqTitle', 'Frequently Asked Questions')}</h2>
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
