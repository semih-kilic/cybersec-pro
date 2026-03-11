use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: Option<String>,
    pub command_template: Option<String>,
    pub parameters: Option<JsonValue>,
    pub plan_required: Option<String>,
    pub is_active: Option<bool>,
    pub created_at: Option<NaiveDateTime>,
    pub tool_type: Option<String>,
    pub hardware_required: Option<JsonValue>,
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
}

#[derive(Debug, Serialize)]
pub struct ToolResponse {
    pub id: String,
    pub name: String,
    pub category: String,
    pub business_category: String,
    pub subcategory: String,
    pub description: Option<String>,
    pub risk_context: String,
    pub parameters: Option<JsonValue>,
    pub plan_required: String,
    pub is_active: bool,
    pub tool_type: String,
    pub hardware_required: Vec<String>,
    pub gui_required: bool,
    pub group: String,
    pub binary_name: String,
}

#[derive(Debug, Serialize)]
pub struct ToolDetailResponse {
    #[serde(flatten)]
    pub base: ToolResponse,
    pub technical_name: String,
    pub install_command: Option<String>,
    pub example_usage: Option<String>,
    pub official_url: Option<String>,
    pub command_template: Option<String>,
    pub kali_package: Option<String>,
}

impl Tool {
    pub fn to_response(&self) -> ToolResponse {
        let hw: Vec<String> = self.hardware_required
            .as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        ToolResponse {
            id: self.id.clone(),
            name: self.name.clone(),
            category: self.category.clone(),
            business_category: self.business_category.clone().unwrap_or_else(|| "web_application_security".into()),
            subcategory: self.subcategory.clone().unwrap_or_default(),
            description: self.description.clone(),
            risk_context: self.risk_context.clone().unwrap_or_default(),
            parameters: self.parameters.clone(),
            plan_required: self.plan_required.clone().unwrap_or_else(|| "starter".into()),
            is_active: self.is_active.unwrap_or(true),
            tool_type: self.tool_type.clone().unwrap_or_else(|| "cli".into()),
            hardware_required: hw,
            gui_required: self.gui_required.unwrap_or(false),
            group: self.tool_group.clone().unwrap_or_else(|| "misc".into()),
            binary_name: self.binary_name.clone().unwrap_or_else(|| self.name.clone()),
        }
    }

    pub fn to_detail_response(&self) -> ToolDetailResponse {
        ToolDetailResponse {
            base: self.to_response(),
            technical_name: self.name.clone(),
            install_command: self.install_command.clone(),
            example_usage: self.example_usage.clone(),
            official_url: self.official_url.clone(),
            command_template: self.command_template.clone(),
            kali_package: self.kali_package.clone(),
        }
    }
}
