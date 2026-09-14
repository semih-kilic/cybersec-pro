import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { FoundingMemberBanner } from '../../components/FoundingMemberBanner';

/** Features shown before the rest collapse behind "More (+N)".
 *  Plans list 6–14 features; without a cap the Enterprise card is three times
 *  the height of Free and the five plans can't share one row. Mirrors the
 *  marketing site's PricingSection (VISIBLE_LIMIT = 5). */
const VISIBLE_FEATURES = 5;

interface PlanFeature {
  name: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  originalMonthlyPrice?: number;
  originalYearlyPrice?: number;
  features: PlanFeature[];
  highlighted?: boolean;
  badge?: string;
  urgencyText?: string;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      { name: 'All 88 security tools', included: true },
      { name: '3 scans per day', included: true },
      { name: '1 concurrent scan', included: true },
      { name: 'PDF report with findings', included: true },
      { name: 'Email support', included: true },
      { name: 'No credit card required', included: true },
    ],
  },
  {
    id: 'founding_member',
    name: 'Founding Member',
    monthlyPrice: 19,
    yearlyPrice: 190,
    originalMonthlyPrice: 99,
    originalYearlyPrice: 949,
    badge: '81% Lifetime Discount',
    urgencyText: 'Limited spots',
    highlighted: true,
    features: [
      { name: 'Unlimited scans', included: true },
      { name: 'Detailed vulnerability reports', included: true },
      { name: 'Priority support', included: true },
      { name: 'Advanced threat intelligence', included: true },
      { name: 'API access', included: true },
      { name: 'Custom scan rules', included: true },
      { name: 'Team collaboration', included: true },
      { name: '1-on-1 Founder Support', included: true },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    yearlyPrice: 279,
    originalMonthlyPrice: undefined,
    originalYearlyPrice: undefined,
    features: [
      { name: 'All 88 security tools', included: true },
      { name: '30 scans per month', included: true },
      { name: '2 concurrent scans', included: true },
      { name: '1 domain/application', included: true },
      { name: 'PDF & HTML reports', included: true },
      { name: 'Scheduled scans', included: true },
      { name: 'Priority email support (48h)', included: true },
      { name: '3 team members', included: true },
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 99,
    yearlyPrice: 949,
    features: [
      { name: 'All 88 security tools', included: true },
      { name: '250 scans per month', included: true },
      { name: '5 concurrent scans', included: true },
      { name: 'Up to 5 domains/applications', included: true },
      { name: 'API access for CI/CD', included: true },
      { name: 'Slack / Teams / Email notifications', included: true },
      { name: 'Compliance reports (NIST, OWASP, GDPR, PCI DSS, HIPAA, SOC 2)', included: true },
      { name: 'White-label PDF reports with company logo', included: true },
      { name: 'LDAP / Active Directory scan', included: true },
      { name: 'Priority support (24h)', included: true },
      { name: '10 team members', included: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 349,
    yearlyPrice: 3349,
    features: [
      { name: 'All 88 security tools', included: true },
      { name: '5,000 scans per month', included: true },
      { name: 'Unlimited concurrent scans', included: true },
      { name: 'Unlimited domains/applications', included: true },
      { name: 'Continuous monitoring (hourly)', included: true },
      { name: 'Dedicated account manager', included: true },
      { name: 'All compliance frameworks (NIST, OWASP, GDPR, PCI DSS, HIPAA, SOC 2)', included: true },
      { name: 'White-label reports with company logo', included: true },
      { name: 'SSO / SAML 2.0 / OIDC / LDAP', included: true },
      { name: 'Unlimited users & team collaboration', included: true },
      { name: 'Advanced API (webhooks, integrations)', included: true },
      { name: 'Custom SLA available on request', included: true },
      { name: 'Priority support (business hours, 2h response)', included: true },
      { name: 'Quarterly security roadmap reviews', included: true },
    ],
  },
];

/** One pricing card. Extracted so each can own its expand/collapse state —
 *  a hook can't live inside the .map() that renders the row. */
function PlanCard({
  plan,
  price,
  originalPrice,
  savings,
  monthlyEquiv,
  billingPeriod,
  ctaLabel,
  onSelect,
}: {
  plan: Plan;
  price: number;
  originalPrice?: number;
  savings: number;
  monthlyEquiv: number;
  billingPeriod: 'month' | 'year';
  ctaLabel: string;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const visible = plan.features.slice(0, VISIBLE_FEATURES);
  const extra = plan.features.slice(VISIBLE_FEATURES);
  const needsCollapse = extra.length > 0;

  const renderFeature = (feature: PlanFeature, idx: number) => (
    <li key={`${feature.name}-${idx}`} className="plan-card__feature">
      <span
        className={`plan-card__feature-icon plan-card__feature-icon--${
          feature.included ? 'included' : 'excluded'
        }`}
      >
        {feature.included ? '✓' : '—'}
      </span>
      {feature.name}
    </li>
  );

  return (
    <div className={`plan-card ${plan.highlighted ? 'plan-card--highlighted' : ''}`}>
      {plan.badge && <div className="plan-card__badge">{plan.badge}</div>}
      <div className="plan-card__urgency">{plan.urgencyText || ' '}</div>
      <h3 className="plan-card__name">{plan.name}</h3>
      <div className="plan-card__price-block">
        {originalPrice && (
          <span className="plan-card__original-price">${originalPrice}</span>
        )}
        <span className="plan-card__price">${price}</span>
        <span className="plan-card__interval">
          /{billingPeriod === 'year' ? 'year' : 'month'}
        </span>
      </div>
      <div className="plan-card__yearly-note">
        {billingPeriod === 'year' && price > 0 ? (
          <>
            <span>
              That's just <strong>${monthlyEquiv}/mo</strong>
            </span>
            {savings > 0 && (
              <>
                {' '}
                <span className="plan-card__yearly-savings">Save ${savings}/year</span>
              </>
            )}
          </>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>

      <ul className="plan-card__features">{visible.map(renderFeature)}</ul>

      <AnimatePresence initial={false}>
        {needsCollapse && expanded && (
          <motion.div
            key="extra-features"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <ul className="plan-card__features plan-card__features--extra">
              {extra.map(renderFeature)}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {needsCollapse && (
        <button
          type="button"
          className="plan-card__more"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <ChevronDown
            size={14}
            className={`plan-card__more-icon ${expanded ? 'plan-card__more-icon--open' : ''}`}
          />
          {expanded ? 'Show less' : `More (+${extra.length})`}
        </button>
      )}

      <button
        className={`plan-card__cta ${
          plan.highlighted ? 'plan-card__cta--primary' : 'plan-card__cta--secondary'
        }`}
        onClick={onSelect}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

export default function UpgradePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [billingPeriod, setBillingPeriod] = useState<'month' | 'year'>(
    (searchParams.get('billing') === 'year' ? 'year' : 'month')
  );
  const [selectedPlan, setSelectedPlan] = useState<string | null>(
    searchParams.get('plan') || null
  );
  const [showCheckout, setShowCheckout] = useState(false);
  const [foundingAvailable, setFoundingAvailable] = useState(true);
  const [currentPlanType, setCurrentPlanType] = useState<string>('trial');

  useEffect(() => {
    const planParam = searchParams.get('plan');
    const billingParam = searchParams.get('billing');
    if (billingParam === 'year') setBillingPeriod('year');
    if (planParam) setSelectedPlan(planParam);
  }, []);

  // Founding Member offer availability (public probe; auto-closes at 10 spots
  // or when a superadmin disables it).
  useEffect(() => {
    fetch('/api/v1/billing/founding-member/status')
      .then((r) => r.json())
      .then((d) => {
        const avail = !!d.available;
        setFoundingAvailable(avail);
        if (!avail) setSelectedPlan((cur) => (cur === 'founding_member' ? null : cur));
      })
      .catch(() => {});
  }, []);

  // Current plan — paid subscribers route changes via Stripe portal.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/v1/billing/subscription', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.plan_type) setCurrentPlanType(d.plan_type);
      })
      .catch(() => {});
  }, []);

  const getPrice = (plan: Plan) => {
    return billingPeriod === 'year' ? plan.yearlyPrice : plan.monthlyPrice;
  };

  const getOriginalPrice = (plan: Plan) => {
    return billingPeriod === 'year' ? plan.originalYearlyPrice : plan.originalMonthlyPrice;
  };

  const getMonthlyEquivalent = (plan: Plan) => {
    if (billingPeriod === 'year') {
      return Math.round(plan.yearlyPrice / 12);
    }
    return plan.monthlyPrice;
  };

  const getYearlySavings = (plan: Plan) => {
    if (billingPeriod === 'year' && plan.monthlyPrice > 0) {
      const totalMonthly = plan.monthlyPrice * 12;
      return totalMonthly - plan.yearlyPrice;
    }
    return 0;
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    setShowCheckout(true);
  };

  // Paid subscribers manage plan changes through the Stripe portal —
  // creating a second checkout subscription would double-bill them.
  const openPortal = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/v1/billing/portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (data.portal_url) {
      window.location.href = data.portal_url;
    } else {
      alert(data.error || 'Could not open the billing portal. Please try from Settings → Billing.');
    }
  };

  const handleCheckout = async () => {
    if (!selectedPlan) return;

    if (selectedPlan === 'free') {
      window.location.href = '/dashboard';
      setShowCheckout(false);
      return;
    }

    // Paid subscribers: route plan changes through the Stripe portal.
    const paidPlans = ['starter', 'professional', 'enterprise', 'founding_member'];
    if (currentPlanType && paidPlans.includes(currentPlanType)) {
      if (selectedPlan === currentPlanType) {
        alert('You are already on this plan. Use Manage Subscription to update it.');
        setShowCheckout(false);
        return;
      }
      setShowCheckout(false);
      await openPortal();
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/billing/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          plan: selectedPlan,
          billing: billingPeriod === 'year' ? 'yearly' : 'monthly',
          success_url: window.location.origin + '/dashboard/settings?tab=billing&success=true',
          cancel_url: window.location.origin + '/dashboard/upgrade',
        }),
      });

      const data = await response.json();

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        alert('Checkout session created. Redirecting to payment...');
        setShowCheckout(false);
      }
    } catch {
      alert('Payment system is being configured. Please contact support@cyber-sec-pro.com to activate your plan.');
      setShowCheckout(false);
    }
  };

  const selectedPlanData = PLANS.find((p) => p.id === selectedPlan);

  return (
    <div className="upgrade-page">
      <style>{`
        .upgrade-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
          font-family: 'Inter', sans-serif;
        }
        .upgrade-page__header {
          text-align: center;
          margin-bottom: 32px;
        }
        .upgrade-page__title {
          font-size: 32px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 12px;
        }
        .upgrade-page__subtitle {
          font-size: 16px;
          color: #515e70;
          margin: 0 0 24px;
        }
        .billing-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0;
          background: #f1f5f9;
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 8px;
        }
        .billing-toggle__btn {
          padding: 10px 24px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          color: #515e70;
          position: relative;
        }
        .billing-toggle__btn--active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .billing-toggle__badge {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
          margin-left: 8px;
          white-space: nowrap;
        }
        .upgrade-page__savings-note {
          font-size: 13px;
          color: #22c55e;
          font-weight: 600;
          margin-top: 4px;
          margin-bottom: 24px;
        }
        /* Every plan shares one row so prices can be compared at a glance.
           auto-flow:column + auto-columns:1fr gives each card its own equal
           column whatever the count (the Founding card drops out once the
           spots are gone), and stretch keeps the row a single height so the
           bottom-pinned CTAs line up. */
        .upgrade-page__grid {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: minmax(0, 1fr);
          gap: 16px;
          align-items: stretch;
        }
        /* Below the width where five columns stay legible, fall back to a
           wrapping grid rather than crushing the cards. */
        @media (max-width: 1180px) {
          .upgrade-page__grid {
            grid-auto-flow: row;
            grid-auto-columns: auto;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
          }
        }
        .plan-card {
          /* flex column so the CTA can be pushed to the bottom (margin-top:auto)
             and every card's button sits on the same line regardless of how many
             features the plan lists */
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          /* tighter than the old 32/24 so five columns breathe */
          padding: 28px 18px;
          position: relative;
          transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
        }
        .plan-card:hover {
          transform: translateY(-4px);
        }
        @media (prefers-reduced-motion: reduce) {
          .plan-card { transition: none; }
          .plan-card:hover { transform: none; }
        }
        .plan-card:hover {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }
        .plan-card--highlighted {
          border: 2px solid #f97316;
          box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);
        }
        .plan-card--highlighted:hover {
          box-shadow: 0 8px 32px rgba(249, 115, 22, 0.2);
        }
        .plan-card__badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #f97316, #f59e0b);
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 14px;
          border-radius: 20px;
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .plan-card__urgency {
          text-align: center;
          color: #dc2626;
          font-size: 13px;
          font-weight: 600;
          line-height: 17px;
          /* rendered on every card (as &nbsp; when the plan has no urgency line)
             so the plan name and price row start at the same height across cards */
          min-height: 17px;
          margin-top: 8px;
          margin-bottom: 4px;
        }
        .plan-card__name {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 16px;
          text-align: center;
        }
        .plan-card__price-block {
          text-align: center;
          margin-bottom: 4px;
        }
        .plan-card__price {
          font-size: 32px;
          font-weight: 800;
          color: #0f172a;
        }
        .plan-card__original-price {
          font-size: 15px;
          /* measured 2.56:1 at #94a3b8 — struck-through, but still has to be read */
          color: #515e70;
          text-decoration: line-through;
          margin-right: 8px;
          font-weight: 400;
        }
        .plan-card__interval {
          font-size: 14px;
          color: #515e70;
          font-weight: 400;
        }
        .plan-card__yearly-note {
          text-align: center;
          font-size: 13px;
          color: #515e70;
          margin-bottom: 20px;
          min-height: 20px;
        }
        .plan-card__yearly-savings {
          display: inline-block;
          background: #dcfce7;
          color: #16a34a;
          font-size: 12px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
        }
        .plan-card__features {
          list-style: none;
          padding: 0;
          margin: 0 0 10px;
        }
        .plan-card__features--extra {
          margin: 0 0 10px;
        }
        /* "More (+N)" / "Show less" disclosure, mirroring the marketing site */
        .plan-card__more {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin: 0 0 18px;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          /* orange-500 on white is 2.8:1; orange-700 is 5.1:1 */
          color: #c2410c;
          transition: opacity 0.2s ease;
        }
        .plan-card__more:hover { opacity: 0.75; }
        .plan-card__more-icon { transition: transform 0.3s ease; }
        .plan-card__more-icon--open { transform: rotate(180deg); }
        @media (prefers-reduced-motion: reduce) {
          .plan-card__more-icon { transition: none; }
        }
        .plan-card__feature {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 0;
          font-size: 13px;
          line-height: 1.45;
          color: #334155;
        }
        .plan-card__feature-icon {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        .plan-card__feature-icon--included {
          background: #dcfce7;
          color: #16a34a;
        }
        .plan-card__feature-icon--excluded {
          background: #f1f5f9;
          color: #cbd5e1;
        }
        .plan-card__cta {
          width: 100%;
          /* margin-top:auto absorbs the height difference between plans, pinning
             every CTA to the bottom edge of its (equal-height) card */
          margin-top: auto;
          padding: 12px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: background 0.2s, transform 0.1s;
        }
        .plan-card__cta--primary {
          background: linear-gradient(135deg, #f97316, #f59e0b);
          color: #ffffff;
        }
        .plan-card__cta--primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
        }
        .plan-card__cta--secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }
        .plan-card__cta--secondary:hover {
          background: #e2e8f0;
        }
        .checkout-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .checkout-modal {
          background: #ffffff;
          border-radius: 16px;
          padding: 32px;
          max-width: 440px;
          width: 90%;
          box-shadow: 0 24px 48px rgba(0,0,0,0.2);
        }
        .checkout-modal__title {
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px;
        }
        .checkout-modal__subtitle {
          font-size: 14px;
          color: #515e70;
          margin: 0 0 24px;
        }
        .checkout-modal__summary {
          background: #f8fafc;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 24px;
        }
        .checkout-modal__row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          font-size: 14px;
          color: #334155;
        }
        .checkout-modal__row--total {
          border-top: 1px solid #e2e8f0;
          margin-top: 8px;
          padding-top: 12px;
          font-weight: 700;
          font-size: 16px;
          color: #0f172a;
        }
        .checkout-modal__actions {
          display: flex;
          gap: 12px;
        }
        .checkout-modal__btn {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }
        .checkout-modal__btn--pay {
          background: linear-gradient(135deg, #f97316, #f59e0b);
          color: #ffffff;
        }
        .checkout-modal__btn--pay:hover {
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
        }
        .checkout-modal__btn--cancel {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }
        .checkout-modal__btn--cancel:hover {
          background: #e2e8f0;
        }
        /* The block above is written for a light surface (white cards, #0f172a
           headings). Dark is the DEFAULT theme, where that left the title and
           subtitle dark-on-dark (measured 1.18:1) and the cards floating as
           white slabs. Re-point the surfaces for it. */
        html:not(.light) .upgrade-page__title { color: #f8fafc; }
        html:not(.light) .upgrade-page__subtitle,
        html:not(.light) .upgrade-page__savings-note { color: #94a3b8; }
        html:not(.light) .plan-card {
          background: #111827;
          border-color: #1f2937;
        }
        html:not(.light) .plan-card__name,
        html:not(.light) .plan-card__price { color: #f8fafc; }
        html:not(.light) .plan-card__interval,
        html:not(.light) .plan-card__yearly-note { color: #9ca3af; }
        html:not(.light) .plan-card__original-price { color: #9ca3af; }
        html:not(.light) .plan-card__urgency { color: #f87171; }
        html:not(.light) .plan-card__yearly-savings { background: #064e3b; color: #6ee7b7; }
        html:not(.light) .plan-card__feature { color: #d1d5db; }
        html:not(.light) .plan-card__feature-icon--included { background: #064e3b; color: #6ee7b7; }
        html:not(.light) .plan-card__feature-icon--excluded { background: #1f2937; color: #4b5563; }
        html:not(.light) .plan-card__more { color: #fb923c; }
        html:not(.light) .plan-card__cta--secondary {
          background: #1f2937;
          color: #e5e7eb;
          border-color: #374151;
        }
        html:not(.light) .plan-card__cta--secondary:hover { background: #374151; }
        html:not(.light) .billing-toggle { background: #1f2937; }
        html:not(.light) .billing-toggle__btn { color: #9ca3af; }
        html:not(.light) .billing-toggle__btn--active { background: #374151; color: #f8fafc; }
        html:not(.light) .checkout-modal { background: #111827; }
        html:not(.light) .checkout-modal__title { color: #f8fafc; }
        html:not(.light) .checkout-modal__subtitle { color: #9ca3af; }
        html:not(.light) .checkout-modal__summary { background: #1f2937; }
        html:not(.light) .checkout-modal__row { color: #d1d5db; }
        html:not(.light) .checkout-modal__row--total { color: #f8fafc; border-top-color: #374151; }
        html:not(.light) .checkout-modal__btn--cancel {
          background: #1f2937; color: #e5e7eb; border-color: #374151;
        }
        .checkout-modal__secure {
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          margin-top: 12px;
        }
      `}</style>

      <div className="upgrade-page__header">
        <h1 className="upgrade-page__title">Choose Your Plan</h1>
        <p className="upgrade-page__subtitle">
          Scale your cybersecurity with the right plan for your team
        </p>

        <div className="billing-toggle">
          <button
            className={`billing-toggle__btn ${billingPeriod === 'month' ? 'billing-toggle__btn--active' : ''}`}
            onClick={() => setBillingPeriod('month')}
          >
            Monthly
          </button>
          <button
            className={`billing-toggle__btn ${billingPeriod === 'year' ? 'billing-toggle__btn--active' : ''}`}
            onClick={() => setBillingPeriod('year')}
          >
            Yearly
            <span className="billing-toggle__badge">Save 2 months</span>
          </button>
        </div>
        {billingPeriod === 'year' && (
          <p className="upgrade-page__savings-note">
            Pay for 10 months, get 12 — save up to 17% annually
          </p>
        )}
      </div>

      <div className="upgrade-page__grid">
        {PLANS.filter((p) => p.id !== 'founding_member' || foundingAvailable).map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            price={getPrice(plan)}
            originalPrice={getOriginalPrice(plan)}
            savings={getYearlySavings(plan)}
            monthlyEquiv={getMonthlyEquivalent(plan)}
            billingPeriod={billingPeriod}
            ctaLabel={
              plan.id === 'free'
                ? 'Current Plan'
                : plan.highlighted
                ? 'Claim Founding Spot'
                : 'Select Plan'
            }
            onSelect={() => handleSelectPlan(plan.id)}
          />
        ))}
      </div>

      {showCheckout && selectedPlanData && (
        <div className="checkout-overlay" onClick={() => setShowCheckout(false)}>
          <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="checkout-modal__title">Complete Your Upgrade</h2>
            <p className="checkout-modal__subtitle">
              {selectedPlanData.name} Plan — {billingPeriod === 'year' ? 'Annual' : 'Monthly'} Billing
            </p>

            <div className="checkout-modal__summary">
              <div className="checkout-modal__row">
                <span>Plan</span>
                <span>{selectedPlanData.name}</span>
              </div>
              <div className="checkout-modal__row">
                <span>Billing period</span>
                <span>{billingPeriod === 'year' ? 'Annual' : 'Monthly'}</span>
              </div>
              {billingPeriod === 'year' && getYearlySavings(selectedPlanData) > 0 && (
                <div className="checkout-modal__row" style={{ color: '#16a34a' }}>
                  <span>Annual savings</span>
                  <span>-${getYearlySavings(selectedPlanData)}</span>
                </div>
              )}
              <div className="checkout-modal__row checkout-modal__row--total">
                <span>Total</span>
                <span>
                  ${getPrice(selectedPlanData)}
                  {selectedPlanData.id !== 'free' && (
                    <span style={{ fontWeight: 400, fontSize: 13, color: '#515e70' }}>
                      {' '}/ {billingPeriod === 'year' ? 'year' : 'month'}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="checkout-modal__actions">
              <button
                className="checkout-modal__btn checkout-modal__btn--cancel"
                onClick={() => setShowCheckout(false)}
              >
                Cancel
              </button>
              <button
                className="checkout-modal__btn checkout-modal__btn--pay"
                onClick={handleCheckout}
              >
                {selectedPlanData.id === 'free' ? 'Continue Free' : 'Proceed to Payment'}
              </button>
            </div>
            <p className="checkout-modal__secure">
              Secured by 256-bit SSL encryption. Cancel anytime.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
