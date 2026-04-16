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
    pub daily_scan_limit: u32,   // 0 = unlimited (trial uses daily)
    pub monthly_scan_limit: u32, // 0 = unlimited (paid plans use monthly)
    pub concurrent_scans: u32,   // 0 = unlimited
    pub max_projects: u32,       // 0 = unlimited
    pub max_team_members: u32,   // 0 = unlimited
    pub max_agents: i32,         // -1 = unlimited
    pub trial_days: u32,         // 0 = no trial period
    pub features: PlanFeatures,
}

pub fn get_plan_configs() -> HashMap<&'static str, PlanConfig> {
    let mut plans = HashMap::new();

    // Trial: 14 days, 3 scans/day, 1 concurrent, all tools accessible
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
            pdf_reports: false,
            html_reports: false,
            api_access: false,
            sso_saml: false,
            compliance_reports: false,
            remote_agents: false,
            scheduled_scans: false,
            ai_suggestions: false,
            ai_remediation: false,
            priority_support: false,
            purple_team: false,
            ldap_ad_scan: false,
        },
    });

    // Starter: 30 scans/month, 2 concurrent
    plans.insert("starter", PlanConfig {
        level: 1,
        price_eur: 99,
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
            remote_agents: false,
            scheduled_scans: true,
            ai_suggestions: false,
            ai_remediation: false,
            priority_support: false,
            purple_team: false,
            ldap_ad_scan: false,
        },
    });

    // Professional: 250 scans/month, 5 concurrent
    plans.insert("professional", PlanConfig {
        level: 2,
        price_eur: 299,
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
            api_access: false,
            sso_saml: false,
            compliance_reports: true,
            remote_agents: true,
            scheduled_scans: true,
            ai_suggestions: true,
            ai_remediation: true,
            priority_support: true,
            purple_team: false,
            ldap_ad_scan: true,
        },
    });

    // Enterprise: 5000 scans/month, unlimited concurrent
    plans.insert("enterprise", PlanConfig {
        level: 3,
        price_eur: 799,
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
