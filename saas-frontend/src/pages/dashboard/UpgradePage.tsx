import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { useState } from 'react';

// Stripe checkout URLs (would be generated server-side in production)
const STRIPE_CHECKOUT_URLS: { [key: string]: string } = {
  professional: 'https://buy.stripe.com/test_professional_cybersecpro',
  team: 'https://buy.stripe.com/test_team_cybersecpro',
  enterprise: 'https://buy.stripe.com/test_enterprise_cybersecpro',
};

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    yearlyPrice: 0,
    period: '14 days',
    description: 'Perfect for trying the platform',
    features: [
      '33 security tools',
      '10 scans per day',
      '1 project',
      'Basic JSON reports',
    ],
    color: 'green',
    popular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 29,
    yearlyPrice: 290,
    period: '/month',
    description: 'For security professionals',
    features: [
      '200+ security tools',
      '50 scans per day',
      'Multi-tool scan (3)',
      '5 projects',
      'PDF/HTML reports',
      'API access',
    ],
    color: 'blue',
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 59,
    yearlyPrice: 590,
    period: '/month',
    description: 'For security teams',
    features: [
      '400+ security tools',
      '200 scans per day',
      'Multi-tool scan (5)',
      'Remote agents (3)',
      '10 team members',
      '20 projects',
      'Slack/Teams integration',
    ],
    color: 'purple',
    popular: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    yearlyPrice: 990,
    period: '/month',
    description: 'For organizations',
    features: [
      'All 682 Kali Linux tools',
      'Unlimited scans',
      'Multi-tool scan (∞)',
      'Unlimited remote agents',
      'Unlimited users & projects',
      'SSO / SAML / LDAP',
      'Compliance reports (OWASP, PCI)',
      '24/7 priority support',
      'GDPR compliant',
    ],
    color: 'yellow',
    popular: false,
  },
];

export default function UpgradePage() {
  const { organization, token } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const currentPlan = organization?.plan_type || 'starter';

  const handleUpgrade = async (planId: string) => {
    if (planId === currentPlan) return;
    
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
          success_url: `${window.location.origin}/dashboard/settings?tab=billing&success=true`,
          cancel_url: `${window.location.origin}/dashboard/upgrade`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.checkout_url) {
          // Open in new tab so dashboard doesn't disappear
          window.open(data.checkout_url, '_blank');
          return;
        }
      }
      
      // Fallback: use direct Stripe link if backend doesn't support
      const stripeUrl = STRIPE_CHECKOUT_URLS[planId];
      if (stripeUrl) {
        // Open in new tab
        window.open(stripeUrl, '_blank');
      } else if (planId === 'enterprise') {
        // Enterprise -> Contact sales page in new tab
        window.open('/contact.html', '_blank');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      // Show error or fallback
      alert('Payment system is currently unavailable. Please try again later or contact cybersecpro@semihkilic.com');
    } finally {
      setLoading(null);
    }
  };

  const getButtonText = (planId: string) => {
    if (loading === planId) return 'Processing...';
    if (planId === currentPlan) return 'Current Plan';
    if (planId === 'enterprise') return 'Contact Sales';
    if (planId === 'starter') return 'Downgrade';
    return 'Upgrade Now';
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green': return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'blue': return 'text-kali-blue border-kali-blue bg-kali-blue/10';
      case 'purple': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
      case 'yellow': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      default: return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">Upgrade Your Plan</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Unlock more tools, higher scan limits, and advanced features to supercharge your security testing.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full">
          <span className="text-gray-400">Current Plan:</span>
          <span className="text-kali-blue font-semibold capitalize">{currentPlan}</span>
        </div>
        {/* Billing Cycle Toggle */}
        <div className="mt-6 inline-flex items-center gap-3 bg-gray-800/50 rounded-full p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${billingCycle === 'monthly' ? 'bg-kali-blue text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${billingCycle === 'yearly' ? 'bg-kali-blue text-white' : 'text-gray-400 hover:text-white'}`}
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
                ? 'border-kali-blue shadow-lg shadow-kali-blue/20'
                : plan.id === currentPlan
                ? 'border-green-500'
                : 'border-gray-800'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-kali-blue to-cyan-500 text-white text-xs font-bold rounded-full z-10 shadow-lg">
                ⭐ Most Popular
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
              <span className="text-4xl font-bold text-white">€{billingCycle === 'yearly' ? plan.yearlyPrice : plan.price}</span>
              <span className="text-gray-500">{plan.price === 0 ? plan.period : billingCycle === 'yearly' ? '/year' : '/month'}</span>
            </div>
            {billingCycle === 'yearly' && plan.price > 0 && (
              <p className="text-green-400 text-xs mb-2">€{(plan.yearlyPrice / 12).toFixed(0)}/mo — save €{plan.price * 12 - plan.yearlyPrice}/year</p>
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
                    : plan.id === 'starter'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
                    : plan.popular
                    ? 'bg-gradient-to-r from-kali-blue to-cyan-500 text-white hover:from-kali-blue/90 hover:to-cyan-500/90 shadow-lg shadow-kali-blue/30'
                    : plan.id === 'team'
                    ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-lg shadow-purple-500/30'
                    : plan.id === 'enterprise'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-bold hover:from-yellow-400 hover:to-orange-400 shadow-lg shadow-yellow-500/30'
                    : `${getColorClasses(plan.color)} border hover:opacity-80`
                }`}
              >
                {getButtonText(plan.id)}
              </button>
            </div>
          </div>
        ))}
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
        <Link to="/dashboard/settings" className="text-kali-blue hover:underline">
          ← Back to Settings
        </Link>
      </div>
    </div>
  );
}
