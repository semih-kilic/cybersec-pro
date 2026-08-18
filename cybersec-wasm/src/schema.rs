use wasm_bindgen::prelude::*;
use serde_json::Value;

#[wasm_bindgen]
pub fn validate_json_schema(schema_json: &str) -> Result<JsValue, JsValue> {
    let schema: Value = serde_json::from_str(schema_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

    let mut issues: Vec<String> = Vec::new();

    if schema.get("@context").is_none() {
        issues.push("Missing @context".to_string());
    }
    if schema.get("@type").is_none() {
        issues.push("Missing @type".to_string());
    }

    let valid = issues.is_empty();
    let result = serde_json::json!({
        "valid": valid,
        "issues": issues,
    });

    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
