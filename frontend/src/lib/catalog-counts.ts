/**
 * Single Source of Truth for Catalog Counts
 * This file is the ONLY place where catalog numbers are defined.
 * All other files (frontend, backend, SEO, schema) MUST import from here.
 * 
 * DO NOT hardcode numbers like 325, 329, 778, 22, 61 anywhere else.
 * Import from this file instead.
 */

export const CATALOG_COUNTS = {
  // Database verified counts (SELECT ... WHERE is_active = TRUE, 2026-09-05).
  // Only active, curated tools are shown/runnable in the product — every one
  // has a working parameter form and is verified to run end-to-end. Inactive
  // rows (missing binaries / broken) are NOT counted here and never exposed.
  TOTAL_TOOLS: 89,            // is_active = TRUE (all curated, all have a form)
  TOTAL_CATEGORIES: 14,       // distinct categories among active tools
  WORKING_TOOLS: 89,          // every active tool runs end-to-end
  TOTAL_TOOLS_DEPRECATED: {
    V87: 87,        // prior curated count (before arjun + dmitry) — do not use
    V325: 325,      // old marketing number — do not use
    V778: 778,      // inflated (included inactive/deprecated) — do not use
    V183: 183,      // stale (2026-08-10, before curation) — do not use
    V396: 396,      // stale locale value — do not use
    V1510: 1510,    // total catalog rows incl. inactive/broken — NOT the product count
  },

  // Plan limits (from rust-backend/src/services/plan.rs)
  PLANS: {
    trial: {
      daily_scans: 3,
      monthly_scans: 0,
      concurrent_scans: 1,
    },
    starter: {
      daily_scans: 0,
      monthly_scans: 30,
      concurrent_scans: 2,
    },
    professional: {
      daily_scans: 0,
      monthly_scans: 250,
      concurrent_scans: 5,
    },
    enterprise: {
      daily_scans: 0,
      monthly_scans: 5000,
      concurrent_scans: 10,
    },
    trial_days: 3,
  },

  // Tool health thresholds
  HEALTH_THRESHOLDS: {
    HEALTHY: 100,    // Score 100 = healthy
    DEGRADED: 50,    // Score 50-99 = degraded
    UNHEALTHY: 0,    // Score < 50 = unhealthy
  },
} as const;

// Type-safe accessors
export const getTotalTools = () => CATALOG_COUNTS.TOTAL_TOOLS;
export const getTotalCategories = () => CATALOG_COUNTS.TOTAL_CATEGORIES;
export const getWorkingTools = () => CATALOG_COUNTS.WORKING_TOOLS;
export const getPlanLimits = (plan: keyof typeof CATALOG_COUNTS.PLANS) => 
  CATALOG_COUNTS.PLANS[plan];

// Type exports
export type CatalogCounts = typeof CATALOG_COUNTS;
export type PlanLimits = typeof CATALOG_COUNTS.PLANS.trial;
export type Locales = 'en' | 'tr' | 'de' | 'fr' | 'es' | 'ar' | 'ja' | 'zh' | 'ru' | 'ko';
