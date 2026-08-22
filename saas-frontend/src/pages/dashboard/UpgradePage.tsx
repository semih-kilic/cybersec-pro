import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FoundingMemberBanner } from '../../components/FoundingMemberBanner';

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
      { name: '5 scans per month', included: true },
      { name: 'Basic vulnerability reports', included: true },
      { name: 'Community support', included: true },
      { name: 'Advanced threat intelligence', included: false },
      { name: 'API access', included: false },
      { name: 'Custom scan rules', included: false },
      { name: 'Priority support', included: false },
      { name: 'Team collaboration', included: false },
    ],
  },
  {
    id: 'founding_member',
    name: 'Founding Member',
    monthlyPrice: 19,
    yearlyPrice: 190,
    originalMonthlyPrice: 99,
    originalYearlyPrice: 990,
    badge: '81% Lifetime Discount',
    urgencyText: 'Only 6 spots left',
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
    yearlyPrice: 290,
    originalMonthlyPrice: undefined,
    originalYearlyPrice: undefined,
    features: [
      { name: '50 scans per month', included: true },
      { name: 'Detailed vulnerability reports', included: true },
      { name: 'Email support', included: true },
      { name: 'Advanced threat intelligence', included: true },
      { name: 'API access', included: false },
      { name: 'Custom scan rules', included: false },
      { name: 'Team collaboration', included: false },
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 99,
    yearlyPrice: 990,
    features: [
      { name: 'Unlimited scans', included: true },
      { name: 'Detailed vulnerability reports', included: true },
      { name: 'Priority support', included: true },
      { name: 'Advanced threat intelligence', included: true },
      { name: 'API access', included: true },
      { name: 'Custom scan rules', included: true },
      { name: 'Team collaboration', included: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 349,
    yearlyPrice: 3490,
    features: [
      { name: 'Unlimited scans', included: true },
      { name: 'Detailed vulnerability reports', included: true },
      { name: 'Dedicated support', included: true },
      { name: 'Advanced threat intelligence', included: true },
      { name: 'API access', included: true },
      { name: 'Custom scan rules', included: true },
      { name: 'Team collaboration', included: true },
      { name: 'Custom integrations', included: true },
      { name: 'SLA guarantee', included: true },
    ],
  },
];

export default function UpgradePage() {
  const { t } = useTranslation();
  const [billingPeriod, setBillingPeriod] = useState<'month' | 'year'>('month');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

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

  const handleCheckout = async () => {
    if (!selectedPlan) return;

    if (selectedPlan === 'founding_member') {
      window.location.href = 'mailto:founders@cyber-sec-pro.com?subject=Founding%20Member%20Signup&body=Hi%2C%0A%0AI%20want%20to%20claim%20a%20Founding%20Member%20spot.%0A%0AName%3A%0ACompany%3A%0AEmail%3A';
      setShowCheckout(false);
      return;
    }

    if (selectedPlan === 'free') {
      window.location.href = '/dashboard';
      setShowCheckout(false);
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
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
          color: #64748b;
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
          color: #64748b;
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
        .upgrade-page__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 24px;
          align-items: start;
        }
        .plan-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 32px 24px;
          position: relative;
          transition: box-shadow 0.2s, transform 0.2s;
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
          margin-top: 8px;
          margin-bottom: 4px;
        }
        .plan-card__name {
          font-size: 20px;
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
          font-size: 40px;
          font-weight: 800;
          color: #0f172a;
        }
        .plan-card__original-price {
          font-size: 18px;
          color: #94a3b8;
          text-decoration: line-through;
          margin-right: 8px;
          font-weight: 400;
        }
        .plan-card__interval {
          font-size: 14px;
          color: #64748b;
          font-weight: 400;
        }
        .plan-card__yearly-note {
          text-align: center;
          font-size: 13px;
          color: #64748b;
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
          margin: 0 0 24px;
        }
        .plan-card__feature {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          font-size: 14px;
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
          color: #64748b;
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
        {PLANS.map((plan) => {
          const price = getPrice(plan);
          const originalPrice = getOriginalPrice(plan);
          const savings = getYearlySavings(plan);
          const monthlyEquiv = getMonthlyEquivalent(plan);

          return (
            <div
              key={plan.id}
              className={`plan-card ${plan.highlighted ? 'plan-card--highlighted' : ''}`}
            >
              {plan.badge && (
                <div className="plan-card__badge">{plan.badge}</div>
              )}
              {plan.urgencyText && (
                <div className="plan-card__urgency">{plan.urgencyText}</div>
              )}
              <h3 className="plan-card__name">{plan.name}</h3>
              <div className="plan-card__price-block">
                {originalPrice && (
                  <span className="plan-card__original-price">
                    €{originalPrice}
                  </span>
                )}
                <span className="plan-card__price">
                  €{price}
                </span>
                <span className="plan-card__interval">
                  /{billingPeriod === 'year' ? 'year' : 'month'}
                </span>
              </div>
              <div className="plan-card__yearly-note">
                {billingPeriod === 'year' && price > 0 ? (
                  <>
                    <span>That's just <strong>€{monthlyEquiv}/mo</strong></span>
                    {savings > 0 && (
                      <>
                        {' '}
                        <span className="plan-card__yearly-savings">
                          Save €{savings}/year
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span>&nbsp;</span>
                )}
              </div>
              <ul className="plan-card__features">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="plan-card__feature">
                    <span
                      className={`plan-card__feature-icon plan-card__feature-icon--${feature.included ? 'included' : 'excluded'}`}
                    >
                      {feature.included ? '✓' : '—'}
                    </span>
                    {feature.name}
                  </li>
                ))}
              </ul>
              <button
                className={`plan-card__cta ${plan.highlighted ? 'plan-card__cta--primary' : 'plan-card__cta--secondary'}`}
                onClick={() => handleSelectPlan(plan.id)}
              >
                {plan.id === 'free' ? 'Current Plan' : plan.highlighted ? 'Claim Founding Spot' : 'Select Plan'}
              </button>
            </div>
          );
        })}
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
                  <span>-€{getYearlySavings(selectedPlanData)}</span>
                </div>
              )}
              <div className="checkout-modal__row checkout-modal__row--total">
                <span>Total</span>
                <span>
                  €{getPrice(selectedPlanData)}
                  {selectedPlanData.id !== 'free' && (
                    <span style={{ fontWeight: 400, fontSize: 13, color: '#64748b' }}>
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
