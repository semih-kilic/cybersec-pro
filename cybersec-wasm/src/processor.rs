use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct ToolData {
    #[serde(flatten)]
    pub data: serde_json::Value,
    pub category: String,
    pub sort_key: String,
}

#[wasm_bindgen]
pub fn process_tools(raw_json: &str, locale: &str) -> Result<JsValue, JsValue> {
    let raw: serde_json::Value = serde_json::from_str(raw_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

    let categories = raw.as_object()
        .ok_or_else(|| JsValue::from_str("Expected JSON object"))?;

    let mut all_tools: Vec<ToolData> = Vec::new();

    for (cat_name, cat_data) in categories {
        let tools_array = cat_data.get("tools")
            .and_then(|v| v.as_array())
            .ok_or_else(|| JsValue::from_str(&format!("Missing tools in category: {}", cat_name)))?;

        for tool in tools_array {
            let mut tool_copy = tool.clone();
            tool_copy.as_object_mut().map(|m| {
                m.insert("category".to_string(), serde_json::Value::String(cat_name.clone()));
            });

            let name = tool.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let sort_key = match locale {
                "tr" => turkish_sort_key(name),
                _ => name.to_lowercase(),
            };

            all_tools.push(ToolData {
                data: tool_copy,
                category: cat_name.clone(),
                sort_key,
            });
        }
    }

    all_tools.sort_by(|a, b| a.sort_key.cmp(&b.sort_key));

    let result = serde_json::json!({
        "tools": all_tools,
        "count": all_tools.len(),
        "categories": {
            "all": all_tools.len(),
        }
    });

    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn generate_tool_schema(tool_json: &str, base_url: &str) -> Result<JsValue, JsValue> {
    let tool: serde_json::Value = serde_json::from_str(tool_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

    let name = tool.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown Tool");
    let description = tool.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let category = tool.get("category").and_then(|v| v.as_str()).unwrap_or("security");

    let slug = name.to_lowercase().replace(' ', "-").chars().filter(|c| c.is_alphanumeric() || *c == '-').collect::<String>();

    let schema = serde_json::json!({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": name,
        "description": description,
        "applicationCategory": format!("SecurityApplication"),
        "url": format!("{}/tools/{}", base_url, slug),
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "operatingSystem": "Web",
        "provider": {
            "@type": "Organization",
            "name": "CyberSec Pro",
            "url": base_url
        }
    });

    serde_wasm_bindgen::to_value(&schema).map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn generate_tools_page_schema(tools_json: &str, base_url: &str) -> Result<JsValue, JsValue> {
    let tools: Vec<serde_json::Value> = serde_json::from_str(tools_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

    let schemas: Vec<serde_json::Value> = tools.iter().filter_map(|tool| {
        let name = tool.get("name")?.as_str()?;
        let description = tool.get("description")?.as_str()?;
        let category = tool.get("category").and_then(|v| v.as_str()).unwrap_or("security");
        let slug = name.to_lowercase().replace(' ', "-").chars().filter(|c| c.is_alphanumeric() || *c == '-').collect::<String>();

        Some(serde_json::json!({
            "@type": "SoftwareApplication",
            "name": name,
            "description": description,
            "applicationCategory": format!("SecurityApplication/{}", category),
            "url": format!("{}/tools/{}", base_url, slug),
        }))
    }).collect();

    let page_schema = serde_json::json!({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "CyberSec Pro Security Tools",
        "description": "Complete list of security tools available on CyberSec Pro",
        "mainEntity": {
            "@type": "ItemList",
            "numberOfItems": schemas.len(),
            "itemListElement": schemas.into_iter().enumerate().map(|(i, s)| {
                serde_json::json!({
                    "@type": "ListItem",
                    "position": i + 1,
                    "item": s
                })
            }).collect::<Vec<_>>()
        }
    });

    serde_wasm_bindgen::to_value(&page_schema).map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

fn turkish_sort_key(s: &str) -> String {
    s.to_lowercase()
        .replace('i', "\x01")
        .replace('ı', "\x02")
        .replace('ş', "\x03")
        .replace('ğ', "\x04")
        .replace('ü', "\x05")
        .replace('ö', "\x06")
        .replace('ç', "\x07")
}
