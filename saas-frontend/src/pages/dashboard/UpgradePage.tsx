import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Check,
  Sparkles,
  ShieldCheck,
  Crown,
  Rocket,
  Zap,
  ArrowLeft,
  TrendingDown,
  Calculator,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToolCounts, useCreateCheckout } from '../../hooks/useApiQueries';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { PageHeader, StatusPill, Section } from '../../components/vos';

type PlanId = 'trial' | 'starter' | 'professional' | 'enterprise';

interface Plan {
  id: PlanId;
  name: string;
  price: number;
  yearlyPrice: number;
  period: string;
  description: string;
  features: string[];
  popular: boolean;
  icon: typeof Rocket;
  accent: string; // tailwind text color class for icon
  ring: string;   // tailwind ring color class for popular
}

function buildPlans(counts: { trial: number; starter: number; professional: number; enterprise: number }): Plan[] {
  return [
    {
      id: 'trial',
      name: 'Free Trial',
      price: 0,
      yearlyPrice: 0,
      period: '3 days',
      description: 'Test drive the full platform.',
      features: [
        `All ${counts.trial} security tools`,
        '3 scans per day',
        '1 concurrent scan',
        'PDF report with findings',
        'Email support',
        'No credit card required',
      ],
      popular: false,
      icon: Sparkles,
      accent: 'text-vos-success',
      ring: 'ring-vos-success/30',
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 99,
      yearlyPrice: 990,
      period: '/month',
      description: 'For a single website or app.',
      features: [
        `All ${counts.starter} security tools`,
        '30 scans per month',
        '2 concurrent scans',
        '1 domain / application',
        'PDF & HTML reports',
        'Scheduled scans',
        'Priority email support (48h)',
        '3 team members',
      ],
      popular: false,
      icon: Rocket,
      accent: 'text-vos-info',
      ring: 'ring-vos-info/30',
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 299,
      yearlyPrice: 2990,
      period: '/month',
      description: 'For growing SaaS and tech companies.',
      features: [
        `All ${counts.professional} security tools`,
        '250 scans per month',
        '5 concurrent scans',
        'Up to 5 domains / applications',
        'API access for CI/CD',
        'Slack / Teams / Email notifications',
        'Compliance: NIST, OWASP, GDPR, PCI DSS, HIPAA, SOC 2',
        'White-label PDF reports',
        'LDAP / Active Directory scan',
        'Priority support (24h)',
        '10 team members',
      ],
      popular: true,
      icon: ShieldCheck,
      accent: 'text-vos-accent',
      ring: 'ring-vos-accent/40',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 799,
      yearlyPrice: 0,
      period: '/month',
      description: 'For security-conscious organisations.',
      features: [
        `All ${counts.enterprise} security tools`,
        '5,000 scans per month',
        'Unlimited concurrent scans',
        'Unlimited domains / applications',
        'Continuous monitoring (hourly)',
        'Dedicated account manager',
        'All compliance frameworks',
        'White-label reports with company logo',
        'SSO / SAML / LDAP',
        'Unlimited users & team collaboration',
        'Advanced API (webhooks, integrations)',
        'SLA guarantee (99.9% uptime)',
        '24/7 priority support (2h response)',
        'Quarterly security roadmap reviews',
      ],
      popular: false,
      icon: Crown,
      accent: 'text-[var(--vos-purple,#a855f7)]',
      ring: 'ring-purple-400/30',
    },
  ];
}

const PLAN_LEVELS: PlanId[] = ['trial', 'starter', 'professional', 'enterprise'];

export default function UpgradePage() {
  useDocumentTitle('Upgrade — CyberSec Pro');
  const { organization } = useAuth();
  const { t } = useTranslation();
  const checkoutMutation = useCreateCheckout();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [pentestsPerYear, setPentestsPerYear] = useState(2);
  const [costPerPentest, setCostPerPentest] = useState(12000);
  const currentPlan = (organization?.plan_type as PlanId) || 'starter';
  const toast = useToast();

  const { data: toolCounts } = useToolCounts();
  const totalToolsFallback = toolCounts?.total ?? 396;
  const plans = useMemo(
    () =>
      buildPlans({
        trial: toolCounts?.plans?.trial ?? totalToolsFallback,
        starter: toolCounts?.plans?.starter ?? totalToolsFallback,
        professional: toolCounts?.plans?.professional ?? totalToolsFallback,
        enterprise: toolCounts?.plans?.enterprise ?? totalToolsFallback,
      }),
    [toolCounts, totalToolsFallback]
  );

  const handleUpgrade = async (planId: PlanId) => {
    if (planId === currentPlan) return;
    if (planId === 'trial') return;

    if (planId === 'enterprise') {
      setLoading(planId);
      try {
        const data: any = await checkoutMutation.mutateAsync({ plan: planId, billing: billingCycle });
        if (data.checkout_url || data.url) {
          window.location.href = data.checkout_url || data.url;
          return;
        }
        toast.success('For Enterprise activation, contact cybersecpro@semihkilic.com.');
      } catch {
        toast.success('Enterprise plan available — contact cybersecpro@semihkilic.com for activation.');
      } finally {
        setLoading(null);
      }
      return;
    }

    setLoading(planId);
    try {
      const data: any = await checkoutMutation.mutateAsync({ plan: planId, billing: billingCycle });
      if (data.checkout_url || data.url) {
        window.location.href = data.checkout_url || data.url;
        return;
      }
      toast.success('Please contact cybersecpro@semihkilic.com to upgrade your plan.');
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || '';
      if (msg.includes('not configured') || msg.includes('Stripe')) {
        toast.success('Please contact cybersecpro@semihkilic.com to upgrade your plan.');
      } else {
        toast.error('Connection error. Please try again or contact cybersecpro@semihkilic.com.');
      }
    } finally {
      setLoading(null);
    }
  };

  const getButtonText = (planId: PlanId) => {
    if (loading === planId) return 'Processing…';
    if (planId === currentPlan) return 'Current plan';
    if (planId === 'trial') return 'Start free trial';
    const currentLevel = PLAN_LEVELS.indexOf(currentPlan);
    const targetLevel = PLAN_LEVELS.indexOf(planId);
    if (targetLevel < currentLevel) return 'Downgrade';
    return 'Upgrade';
  };

  const annualSavings = Math.max(0, pentestsPerYear * costPerPentest - 3588);
  const reductionPct = Math.max(
    0,
    Math.min(100, Math.round((1 - 3588 / Math.max(1, pentestsPerYear * costPerPentest)) * 100))
  );

  return (
    <div className="space-y-vos-8">
      <PageHeader
        eyebrow="Plans"
        title={t('upgrade.title', 'Upgrade your workspace')}
        description={t(
          'upgrade.subtitle',
          'Choose the plan that matches your security operations. Cancel or change at any time.'
        )}
        icon={<Zap className="w-5 h-5" />}
        badge={
          <StatusPill tone="accent">
            Current: <span className="capitalize ml-1">{currentPlan}</span>
          </StatusPill>
        }
        actions={
          <div className="inline-flex items-center rounded-vos-pill border border-vos-border-1 bg-vos-bg-elev-2 p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-vos-4 py-1.5 rounded-vos-pill text-vos-sm font-medium transition ${
                billingCycle === 'monthly'
                  ? 'bg-vos-accent text-white shadow-sm'
                  : 'text-vos-text-3 hover:text-vos-text'
              }`}
            >
              {t('upgrade.monthly', 'Monthly')}
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-vos-4 py-1.5 rounded-vos-pill text-vos-sm font-medium transition flex items-center gap-1.5 ${
                billingCycle === 'yearly'
                  ? 'bg-vos-accent text-white shadow-sm'
                  : 'text-vos-text-3 hover:text-vos-text'
              }`}
            >
              {t('upgrade.yearly', 'Yearly')}
              <span className="text-[10px] uppercase tracking-vos-wide font-bold text-vos-success bg-vos-success/15 px-1.5 py-0.5 rounded">
                {t('upgrade.savePercent', 'Save 17%')}
              </span>
            </button>
          </div>
        }
      />

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-vos-5 items-stretch">
        {plans.map((plan, idx) => {
          const Icon = plan.icon;
          const isCurrent = plan.id === currentPlan;
          const isPopular = plan.popular;
          const monthly = plan.price === 0
            ? '€0'
            : billingCycle === 'yearly' && plan.yearlyPrice > 0
              ? `€${Math.round(plan.yearlyPrice / 12)}`
              : `€${plan.price}`;
          const period = plan.price === 0
            ? plan.period
            : billingCycle === 'yearly' && plan.yearlyPrice > 0
              ? '/mo billed annually'
              : '/month';

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className={`relative flex flex-col rounded-vos-xl border bg-vos-bg-elev-2 p-vos-6 transition ${
                isPopular ? `border-vos-accent ring-2 ${plan.ring} shadow-vos-lg` : 'border-vos-border-1 hover:border-vos-border-2'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-vos-3 py-1 rounded-vos-pill bg-vos-accent text-white text-[10px] uppercase tracking-vos-wide font-bold shadow-sm">
                    <Sparkles className="w-3 h-3" />
                    {t('upgrade.popular', 'Most popular')}
                  </span>
                </div>
              )}
              {isCurrent && !isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-vos-3 py-1 rounded-vos-pill bg-vos-success text-white text-[10px] uppercase tracking-vos-wide font-bold shadow-sm">
                    <Check className="w-3 h-3" />
                    Current
                  </span>
                </div>
              )}

              <div className="flex items-center gap-vos-3 mb-vos-4">
                <span className={`w-10 h-10 rounded-vos-md bg-vos-bg-elev-1 border border-vos-border-1 flex items-center justify-center ${plan.accent}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-vos-md font-semibold text-vos-text tracking-vos-snug">{plan.name}</h3>
                  <p className="text-vos-xs text-vos-text-3">{plan.description}</p>
                </div>
              </div>

              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-4xl font-semibold text-vos-text tracking-tight">{monthly}</span>
                <span className="text-vos-xs text-vos-text-3">{period}</span>
              </div>
              {billingCycle === 'yearly' && plan.yearlyPrice > 0 && (
                <p className="text-vos-xs text-vos-success mb-vos-4">
                  €{plan.yearlyPrice}/year — save €{plan.price * 12 - plan.yearlyPrice} ({Math.round((1 - plan.yearlyPrice / (plan.price * 12)) * 100)}% off)
                </p>
              )}
              {plan.id === 'enterprise' && billingCycle === 'yearly' && (
                <p className="text-vos-xs text-vos-text-3 mb-vos-4">
                  {t('upgrade.customPricing', 'Custom annual pricing — contact sales.')}
                </p>
              )}
              {(plan.price === 0 || (billingCycle === 'monthly' && plan.id !== 'enterprise')) && (
                <div className="mb-vos-4" />
              )}

              <ul className="space-y-vos-2 mb-vos-6 flex-grow">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-vos-sm text-vos-text-2">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.accent}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent || loading === plan.id}
                className={`w-full py-vos-3 rounded-vos-md font-semibold text-vos-sm transition ${
                  isCurrent
                    ? 'bg-vos-bg-elev-1 text-vos-text-3 border border-vos-border-1 cursor-not-allowed'
                    : isPopular
                      ? 'bg-vos-accent text-white hover:bg-vos-accent/90 shadow-sm'
                      : 'bg-vos-bg-elev-1 text-vos-text border border-vos-border-1 hover:border-vos-accent/50 hover:text-vos-accent'
                }`}
              >
                {getButtonText(plan.id)}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* ROI Calculator */}
      <Section
        title={
          <span className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-vos-accent" />
            {t('upgrade.roiCalculator', 'ROI calculator')}
          </span>
        }
        description={t('upgrade.roiDesc', 'See how much you save compared to traditional penetration testing.')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-vos-6 items-start">
          <div className="space-y-vos-5">
            <div>
              <label className="text-vos-xs uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5 block">
                {t('upgrade.pentestsPerYear', 'Pentests per year')}
              </label>
              <input
                type="range"
                min={1}
                max={6}
                value={pentestsPerYear}
                onChange={(e) => setPentestsPerYear(Number(e.target.value))}
                className="w-full accent-vos-accent"
              />
              <div className="flex justify-between text-vos-xs text-vos-text-3 mt-1">
                <span>1</span>
                <span className="text-vos-accent font-bold text-vos-sm">{pentestsPerYear}</span>
                <span>6</span>
              </div>
            </div>
            <div>
              <label className="text-vos-xs uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5 block">
                {t('upgrade.avgCostPerPentest', 'Average cost per pentest (€)')}
              </label>
              <input
                type="range"
                min={5000}
                max={25000}
                step={1000}
                value={costPerPentest}
                onChange={(e) => setCostPerPentest(Number(e.target.value))}
                className="w-full accent-vos-accent"
              />
              <div className="flex justify-between text-vos-xs text-vos-text-3 mt-1">
                <span>€5K</span>
                <span className="text-vos-accent font-bold text-vos-sm">€{costPerPentest.toLocaleString()}</span>
                <span>€25K</span>
              </div>
            </div>
          </div>

          <div className="rounded-vos-lg border border-vos-border-1 bg-vos-bg-elev-1 p-vos-5 space-y-vos-4">
            <div className="flex justify-between items-center">
              <span className="text-vos-sm text-vos-text-3">{t('upgrade.traditionalPentests', 'Traditional pentests')}</span>
              <span className="text-vos-md font-semibold text-vos-danger">
                €{(pentestsPerYear * costPerPentest).toLocaleString()}/yr
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-vos-sm text-vos-text-3">{t('upgrade.cybersecPro', 'CyberSec Pro Professional')}</span>
              <span className="text-vos-md font-semibold text-vos-success">€3,588/yr</span>
            </div>
            <div className="border-t border-vos-border-1 pt-vos-4">
              <div className="flex justify-between items-baseline">
                <span className="text-vos-sm font-semibold text-vos-text">{t('upgrade.yourSavings', 'Your savings')}</span>
                <div className="text-right">
                  <span className="text-2xl font-semibold text-vos-success tracking-tight">
                    €{annualSavings.toLocaleString()}
                  </span>
                  <span className="text-vos-xs text-vos-success ml-1">/ year</span>
                </div>
              </div>
              <div className="mt-vos-3 w-full bg-vos-bg-elev-2 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-vos-success to-vos-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${reductionPct}%` }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <p className="text-vos-xs text-vos-success font-medium mt-vos-2 inline-flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                {reductionPct}% cost reduction
              </p>
            </div>
            <p className="text-vos-xs text-vos-text-3">
              {t('upgrade.plusDesc', 'Plus continuous monitoring, automated scans, and real-time alerts — not just point-in-time testing.')}
            </p>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section
        title={
          <span className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-vos-text-3" />
            {t('upgrade.faqTitle', 'Frequently asked questions')}
          </span>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-vos-4">
          {[
            {
              q: 'How do I upgrade my plan?',
              a: 'Click the “Upgrade” button on your desired plan. You will be redirected to our secure payment processor.',
            },
            {
              q: 'Can I downgrade my plan?',
              a: 'Yes. Your new plan will take effect at the start of the next billing cycle.',
            },
            {
              q: 'What payment methods do you accept?',
              a: 'All major credit cards (Visa, MasterCard, Amex), PayPal, and bank transfers for Enterprise plans.',
            },
            {
              q: 'Is there a money-back guarantee?',
              a: 'Yes, a 30-day money-back guarantee. Contact us for a full refund if you are not satisfied.',
            },
          ].map((faq, i) => (
            <div key={i} className="rounded-vos-lg border border-vos-border-1 bg-vos-bg-elev-1 p-vos-4">
              <h3 className="text-vos-sm font-semibold text-vos-text mb-1.5">{faq.q}</h3>
              <p className="text-vos-xs text-vos-text-3 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="text-center">
        <Link
          to="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-vos-sm text-vos-accent hover:text-vos-accent/80 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to settings
        </Link>
      </div>
    </div>
  );
}
