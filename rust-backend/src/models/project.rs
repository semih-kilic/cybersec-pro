use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Project {
    pub id: i32,
    pub organization_id: String,
    pub name: String,
    pub description: Option<String>,
    pub target_type: Option<String>,
    pub target_url: Option<String>,
    pub target_ip: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize)]
pub struct ProjectResponse {
    pub id: i32,
    pub name: String,
    pub description: String,
    pub target_type: String,
    pub target_url: Option<String>,
    pub target_ip: Option<String>,
    pub status: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl Project {
    pub fn to_response(&self) -> ProjectResponse {
        ProjectResponse {
            id: self.id,
            name: self.name.clone(),
            description: self.description.clone().unwrap_or_default(),
            target_type: self.target_type.clone().unwrap_or_else(|| "web".into()),
            target_url: self.target_url.clone(),
            target_ip: self.target_ip.clone(),
            status: self.status.clone().unwrap_or_else(|| "active".into()),
            created_at: self.created_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
            updated_at: self.updated_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
        }
    }
}
