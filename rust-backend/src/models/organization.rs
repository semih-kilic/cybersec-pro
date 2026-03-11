use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Organization {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub plan_type: Option<String>,
    pub stripe_customer_id: Option<String>,
    pub created_at: Option<NaiveDateTime>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct OrganizationResponse {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub plan_type: String,
    pub created_at: Option<String>,
    pub is_active: bool,
}

impl Organization {
    pub fn to_response(&self) -> OrganizationResponse {
        OrganizationResponse {
            id: self.id.clone(),
            name: self.name.clone(),
            slug: self.slug.clone(),
            plan_type: self.plan_type.clone().unwrap_or_else(|| "starter".into()),
            created_at: self.created_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            is_active: self.is_active.unwrap_or(true),
        }
    }

    pub fn plan_type_str(&self) -> &str {
        self.plan_type.as_deref().unwrap_or("starter")
    }
}
