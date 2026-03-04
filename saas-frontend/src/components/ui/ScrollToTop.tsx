/**
 * ScrollToTop — V18 Phase 3
 * Scrolls the main content area to top on every route change.
 * Place inside <Router> (or inside DashboardLayout) for SPA navigation UX.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll the main content area (not window, since we use flex layout)
    const main = document.getElementById('main-content');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname]);

  return null;
}

export default ScrollToTop;
