#[allow(dead_code)]
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Subscription {
    pub id: String,
    pub organization_id: String,
    pub stripe_subscription_id: Option<String>,
    pub plan_type: String,
    pub status: Option<String>,
    pub current_period_start: Option<NaiveDateTime>,
    pub current_period_end: Option<NaiveDateTime>,
    pub created_at: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize)]
pub struct SubscriptionResponse {
    pub id: String,
    pub organization_id: String,
    pub plan_type: String,
    pub status: String,
    pub current_period_start: Option<String>,
    pub current_period_end: Option<String>,
    pub created_at: Option<String>,
}

impl Subscription {
    pub fn to_response(&self) -> SubscriptionResponse {
        SubscriptionResponse {
            id: self.id.clone(),
            organization_id: self.organization_id.clone(),
            plan_type: self.plan_type.clone(),
            status: self.status.clone().unwrap_or_else(|| "active".into()),
            current_period_start: self.current_period_start.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            current_period_end: self.current_period_end.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            created_at: self.created_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
        }
    }
}
