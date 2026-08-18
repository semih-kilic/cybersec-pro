/**
 * Single Source of Truth for Catalog Counts
 * This file is the ONLY place where catalog numbers are defined.
 * All other files (frontend, backend, SEO, schema) MUST import from here.
 * 
 * DO NOT hardcode numbers like 325, 329, 778, 22, 61 anywhere else.
 * Import from this file instead.
 */

export const CATALOG_COUNTS = {
  // Database verified counts
  TOTAL_TOOLS: 183,           // Active tools in database (verified 2026-08-10)
  TOTAL_CATEGORIES: 18,       // Distinct categories in tools table
  WORKING_TOOLS: 152,          // Verified working tools (health check passed 2026-08-10)
  TOTAL_TOOLS_DEPRECATED: {
    V325: 325,      // Old marketing number
    V778: 778,      // Inflated number (includes inactive/deprecated)
    V61: 61,        // Working tools count (deprecated label)
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
