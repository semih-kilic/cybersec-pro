#[allow(dead_code)]
use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UsageTracking {
    pub id: String,
    pub organization_id: String,
    pub tool_id: String,
    pub scan_id: Option<String>,
    pub usage_date: Option<NaiveDate>,
    pub created_at: Option<NaiveDateTime>,
}
