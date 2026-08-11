use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanFeatures {
    pub basic_reports: bool,
    pub pdf_reports: bool,
    pub html_reports: bool,
    pub api_access: bool,
    pub sso_saml: bool,
    pub compliance_reports: bool,
    pub remote_agents: bool,
    pub scheduled_scans: bool,
    pub ai_suggestions: bool,
    pub ai_remediation: bool,
    pub priority_support: bool,
    pub purple_team: bool,
    pub ldap_ad_scan: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanConfig {
    pub level: u8,
    pub price_eur: u32,
    pub daily_scan_limit: u32,
    pub monthly_scan_limit: u32,
    pub concurrent_scans: u32,
    pub max_projects: u32,
    pub max_team_members: u32,
    pub max_agents: i32,
    pub trial_days: u32,
    pub features: PlanFeatures,
}

pub fn get_plan_configs() -> HashMap<&'static str, PlanConfig> {
    let mut plans = HashMap::new();

    plans.insert("trial", PlanConfig {
        level: 0,
        price_eur: 0,
        daily_scan_limit: 3,
        monthly_scan_limit: 0,
        concurrent_scans: 1,
        max_projects: 1,
        max_team_members: 1,
        max_agents: 1,
        trial_days: 14,
        features: PlanFeatures {
            basic_reports: true,
            pdf_reports: true,
            html_reports: false,
            api_access: false,
            sso_saml: false,
            compliance_reports: false,
            remote_agents: true,
            scheduled_scans: false,
            ai_suggestions: false,
            ai_remediation: false,
            priority_support: false,
            purple_team: false,
            ldap_ad_scan: false,
        },
    });

    plans.insert("starter", PlanConfig {
        level: 1,
        price_eur: 29,
        daily_scan_limit: 0,
        monthly_scan_limit: 30,
        concurrent_scans: 2,
        max_projects: 1,
        max_team_members: 3,
        max_agents: 1,
        trial_days: 0,
        features: PlanFeatures {
            basic_reports: true,
            pdf_reports: true,
            html_reports: true,
            api_access: false,
            sso_saml: false,
            compliance_reports: false,
            remote_agents: true,
            scheduled_scans: true,
            ai_suggestions: false,
            ai_remediation: false,
            priority_support: true,
            purple_team: false,
            ldap_ad_scan: false,
        },
    });

    plans.insert("professional", PlanConfig {
        level: 2,
        price_eur: 99,
        daily_scan_limit: 0,
        monthly_scan_limit: 250,
        concurrent_scans: 5,
        max_projects: 5,
        max_team_members: 10,
        max_agents: 5,
        trial_days: 0,
        features: PlanFeatures {
            basic_reports: true,
            pdf_reports: true,
            html_reports: true,
            api_access: true,
            sso_saml: false,
            compliance_reports: true,
            remote_agents: true,
            scheduled_scans: true,
            ai_suggestions: true,
            ai_remediation: true,
            priority_support: true,
            purple_team: true,
            ldap_ad_scan: true,
        },
    });

    plans.insert("enterprise", PlanConfig {
        level: 3,
        price_eur: 349,
        daily_scan_limit: 0,
        monthly_scan_limit: 5000,
        concurrent_scans: 0,
        max_projects: 0,
        max_team_members: 0,
        max_agents: -1,
        trial_days: 0,
        features: PlanFeatures {
            basic_reports: true,
            pdf_reports: true,
            html_reports: true,
            api_access: true,
            sso_saml: true,
            compliance_reports: true,
            remote_agents: true,
            scheduled_scans: true,
            ai_suggestions: true,
            ai_remediation: true,
            priority_support: true,
            purple_team: true,
            ldap_ad_scan: true,
        },
    });

    plans
}

pub fn get_plan_level(plan_type: &str) -> u8 {
    match plan_type {
        "trial" | "free" => 0,
        "starter" => 1,
        "professional" => 2,
        "enterprise" => 3,
        _ => 0,
    }
}

pub fn check_plan_access(user_plan: &str, required_plan: &str) -> bool {
    get_plan_level(user_plan) >= get_plan_level(required_plan)
}

#[cfg(test)]
mod tests {
    use super::{check_plan_access, get_plan_configs, get_plan_level};

    #[test]
    fn get_plan_level_returns_correct_level_for_all_plans() {
        assert_eq!(get_plan_level("trial"), 0);
        assert_eq!(get_plan_level("free"), 0);
        assert_eq!(get_plan_level("starter"), 1);
        assert_eq!(get_plan_level("professional"), 2);
        assert_eq!(get_plan_level("enterprise"), 3);
    }

    #[test]
    fn get_plan_level_returns_zero_for_unknown_plan() {
        assert_eq!(get_plan_level("unknown"), 0);
        assert_eq!(get_plan_level(""), 0);
        assert_eq!(get_plan_level("ENTERPRISE"), 0);
    }

    #[test]
    fn get_plan_level_ordering_is_monotonically_increasing() {
        assert!(get_plan_level("trial") < get_plan_level("starter"));
        assert!(get_plan_level("starter") < get_plan_level("professional"));
        assert!(get_plan_level("professional") < get_plan_level("enterprise"));
    }

    #[test]
    fn check_plan_access_allows_same_level() {
        assert!(check_plan_access("trial", "trial"));
        assert!(check_plan_access("starter", "starter"));
        assert!(check_plan_access("enterprise", "enterprise"));
    }

    #[test]
    fn check_plan_access_allows_higher_plan() {
        assert!(check_plan_access("enterprise", "starter"));
        assert!(check_plan_access("professional", "trial"));
        assert!(check_plan_access("starter", "trial"));
    }

    #[test]
    fn check_plan_access_rejects_lower_plan() {
        assert!(!check_plan_access("trial", "starter"));
        assert!(!check_plan_access("starter", "professional"));
        assert!(!check_plan_access("professional", "enterprise"));
    }

    #[test]
    fn check_plan_access_free_is_equivalent_to_trial() {
        assert!(check_plan_access("free", "trial"));
        assert!(!check_plan_access("free", "starter"));
    }

    #[test]
    fn get_plan_configs_contains_all_four_plans() {
        let plans = get_plan_configs();
        assert!(plans.contains_key("trial"));
        assert!(plans.contains_key("starter"));
        assert!(plans.contains_key("professional"));
        assert!(plans.contains_key("enterprise"));
    }

    #[test]
    fn trial_plan_has_daily_limit_and_pdf_reports() {
        let plans = get_plan_configs();
        let trial = &plans["trial"];
        assert_eq!(trial.daily_scan_limit, 3);
        assert_eq!(trial.max_projects, 1);
        assert!(trial.features.pdf_reports);
        assert!(!trial.features.sso_saml);
        assert!(!trial.features.purple_team);
    }

    #[test]
    fn enterprise_plan_has_unlimited_projects_and_all_features() {
        let plans = get_plan_configs();
        let ent = &plans["enterprise"];
        assert_eq!(ent.max_projects, 0);
        assert_eq!(ent.max_agents, -1);
        assert_eq!(ent.concurrent_scans, 0);
        assert!(ent.features.sso_saml);
        assert!(ent.features.purple_team);
        assert!(ent.features.api_access);
    }

    #[test]
    fn plan_levels_match_config_ordering() {
        let plans = get_plan_configs();
        assert_eq!(plans["trial"].level, 0);
        assert_eq!(plans["starter"].level, 1);
        assert_eq!(plans["professional"].level, 2);
        assert_eq!(plans["enterprise"].level, 3);
    }

    #[test]
    fn professional_plan_has_ai_features_but_no_sso() {
        let plans = get_plan_configs();
        let pro = &plans["professional"];
        assert!(pro.features.ai_suggestions);
        assert!(pro.features.ai_remediation);
        assert!(!pro.features.sso_saml);
    }
}
