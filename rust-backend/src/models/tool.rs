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
    pub maturity: Option<String>,
    pub output_parser: Option<String>,
    pub exclusion_reason: Option<String>,
    pub health_status: Option<String>,
    pub health_evidence: Option<String>,
    pub health_probe: Option<String>,
    pub last_health_check: Option<chrono::DateTime<chrono::Utc>>,
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
    pub maturity: String,
    pub output_parser: Option<String>,
    pub health_status: String,
    pub health_probe: Option<String>,
    pub last_health_check: Option<chrono::DateTime<chrono::Utc>>,
    /// Derived: binary is detected on the host (healthy / ok / needs_interactive / broken).
    pub installed: bool,
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
            maturity: self.maturity.clone().unwrap_or_else(|| "experimental".into()),
            output_parser: self.output_parser.clone(),
            health_status: self.health_status.clone().unwrap_or_else(|| "unknown".into()),
            health_probe: self.health_probe.clone(),
            last_health_check: self.last_health_check,
            installed: matches!(
                self.health_status.as_deref(),
                Some("healthy") | Some("ok") | Some("needs_interactive") | Some("broken")
            ),
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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_tool(name: &str) -> Tool {
        Tool {
            id: "tool-001".into(),
            name: name.into(),
            category: "recon".into(),
            description: None,
            command_template: None,
            parameters: None,
            plan_required: None,
            is_active: None,
            created_at: None,
            tool_type: None,
            hardware_required: None,
            gui_required: None,
            install_command: None,
            example_usage: None,
            official_url: None,
            business_name: None,
            business_description: None,
            business_category: None,
            subcategory: None,
            risk_context: None,
            tool_group: None,
            binary_name: None,
            maturity: None,
            output_parser: None,
            exclusion_reason: None,
            kali_package: None,
            health_status: None,
            health_evidence: None,
            health_probe: None,
            last_health_check: None,
        }
    }

    #[test]
    fn test_to_response_defaults() {
        let t = make_tool("nmap");
        let r = t.to_response();
        assert_eq!(r.id, "tool-001");
        assert_eq!(r.name, "nmap");
        assert_eq!(r.category, "recon");
        assert_eq!(r.business_category, "web_application_security");
        assert_eq!(r.plan_required, "starter");
        assert!(r.is_active);
        assert_eq!(r.tool_type, "cli");
        assert_eq!(r.group, "misc");
        // binary_name falls back to name when None
        assert_eq!(r.binary_name, "nmap");
        assert!(!r.gui_required);
        assert!(r.hardware_required.is_empty());
    }

    #[test]
    fn test_to_response_explicit_fields() {
        let mut t = make_tool("burpsuite");
        t.plan_required = Some("professional".into());
        t.is_active = Some(false);
        t.tool_type = Some("gui".into());
        t.gui_required = Some(true);
        t.tool_group = Some("web".into());
        t.binary_name = Some("burp".into());
        t.business_category = Some("web_security".into());
        let r = t.to_response();
        assert_eq!(r.plan_required, "professional");
        assert!(!r.is_active);
        assert_eq!(r.tool_type, "gui");
        assert!(r.gui_required);
        assert_eq!(r.group, "web");
        assert_eq!(r.binary_name, "burp");
        assert_eq!(r.business_category, "web_security");
    }

    #[test]
    fn test_to_response_hardware_required_parsed_from_json() {
        let mut t = make_tool("hashcat");
        t.hardware_required = Some(serde_json::json!(["gpu", "high_ram"]));
        let r = t.to_response();
        assert_eq!(r.hardware_required, vec!["gpu", "high_ram"]);
    }

    #[test]
    fn test_to_detail_response_includes_base_and_extras() {
        let mut t = make_tool("metasploit");
        t.install_command = Some("apt install metasploit-framework".into());
        t.example_usage = Some("msfconsole".into());
        t.official_url = Some("https://metasploit.com".into());
        t.kali_package = Some("metasploit-framework".into());
        let dr = t.to_detail_response();
        assert_eq!(dr.technical_name, "metasploit");
        assert_eq!(dr.install_command.as_deref(), Some("apt install metasploit-framework"));
        assert_eq!(dr.example_usage.as_deref(), Some("msfconsole"));
        assert_eq!(dr.official_url.as_deref(), Some("https://metasploit.com"));
        assert_eq!(dr.kali_package.as_deref(), Some("metasploit-framework"));
        assert_eq!(dr.base.name, "metasploit");
    }

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ToolHealthCheck {
    pub id: String,
    pub tool_id: String,
    pub check_type: String,
    pub status: String,
    pub installed: bool,
    pub version: Option<String>,
    pub runtime_ok: bool,
    pub runtime_output: Option<String>,
    pub dependency_ok: bool,
    pub dependency_output: Option<String>,
    pub response_time_ms: Option<i64>,
    pub error_message: Option<String>,
    pub checked_at: Option<chrono::DateTime<chrono::Utc>>,
}

}
