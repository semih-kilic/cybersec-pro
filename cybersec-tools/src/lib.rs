pub mod db {
    use sqlx::postgres::{PgPool, PgPoolOptions};
    use anyhow::Result;

    pub async fn connect(dsn: &str) -> Result<PgPool> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(dsn)
            .await?;
        Ok(pool)
    }
}

pub mod tools {
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
    pub struct Tool {
        pub id: String,
        pub name: String,
        pub category: String,
        pub description: Option<String>,
        pub command_template: Option<String>,
        pub parameters: Option<serde_json::Value>,
        pub plan_required: Option<String>,
        pub is_active: Option<bool>,
        pub tool_type: Option<String>,
        pub hardware_required: Option<serde_json::Value>,
        pub gui_required: Option<bool>,
        pub install_command: Option<String>,
        pub example_usage: Option<String>,
        pub official_url: Option<String>,
        pub business_name: Option<String>,
        pub business_description: Option<String>,
        pub business_category: Option<String>,
        pub subcategory: Option<String>,
        pub risk_context: Option<String>,
        pub tool_group: Option<String>,
        pub binary_name: Option<String>,
        pub kali_package: Option<String>,
        pub exclusion_reason: Option<String>,
        pub maturity: String,
        pub output_parser: Option<String>,
        pub command_profiles: Option<serde_json::Value>,
        pub health_status: Option<String>,
        pub health_exit_code: Option<i32>,
        pub health_evidence: Option<String>,
        pub health_probe: Option<String>,
        pub last_health_check: Option<chrono::DateTime<chrono::Utc>>,
        pub priority_score: Option<i32>,
        pub version: Option<String>,
    }
}
