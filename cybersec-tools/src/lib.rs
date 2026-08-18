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
        pub category: Option<String>,
        pub binary_name: Option<String>,
        pub command_template: Option<String>,
        pub is_active: Option<bool>,
        pub exclusion_reason: Option<String>,
        pub hardware_required: Option<bool>,
        pub gui_required: Option<bool>,
        pub health_status: Option<String>,
        pub health_exit_code: Option<i32>,
        pub health_evidence: Option<String>,
        pub last_health_check: Option<chrono::NaiveDateTime>,
    }
}
