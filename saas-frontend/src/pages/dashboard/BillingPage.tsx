import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../../hooks/useUtilities';

/**
 * BillingPage - Redirects to Settings with Billing tab active
 */
export default function BillingPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('billing.title', 'Billing')} — CyberSec Pro`);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to settings page with billing tab
    navigate('/dashboard/settings?tab=billing', { replace: true });
  }, [navigate]);

  return (
    <div className="p-6 flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-kali-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">{t('billing.redirecting', 'Redirecting to Billing...')}</p>
      </div>
    </div>
  );
}
