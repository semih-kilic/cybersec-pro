use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct ToolEntry {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SearchIndex {
    tools: Vec<ToolEntry>,
    lower_names: Vec<String>,
    lower_categories: Vec<String>,
    lower_descriptions: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub name: String,
    pub category: String,
    pub score: f32,
}

#[wasm_bindgen]
pub struct ToolSearchEngine {
    index: SearchIndex,
}

#[wasm_bindgen]
impl ToolSearchEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(tools_json: &str) -> Result<ToolSearchEngine, JsValue> {
        let tools: Vec<ToolEntry> = serde_json::from_str(tools_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

        let lower_names: Vec<String> = tools.iter().map(|t| t.name.to_lowercase()).collect();
        let lower_categories: Vec<String> = tools.iter().map(|t| t.category.to_lowercase()).collect();
        let lower_descriptions: Vec<String> = tools.iter().map(|t| t.description.to_lowercase()).collect();

        Ok(ToolSearchEngine {
            index: SearchIndex {
                tools,
                lower_names,
                lower_categories,
                lower_descriptions,
            },
        })
    }

    pub fn search(&self, query: &str, category_filter: &str) -> JsValue {
        let q = query.to_lowercase();
        let cat = category_filter.to_lowercase();

        if q.is_empty() && cat.is_empty() {
            let results: Vec<SearchResult> = self.index.tools.iter().enumerate().map(|(i, t)| {
                SearchResult {
                    id: t.id.clone(),
                    name: t.name.clone(),
                    category: t.category.clone(),
                    score: 1.0,
                }
            }).collect();
            return serde_wasm_bindgen::to_value(&results).unwrap_or(JsValue::NULL);
        }

        let mut scored: Vec<(usize, f32)> = self.index.tools.iter().enumerate().filter_map(|(i, t)| {
            if !cat.is_empty() && self.index.lower_categories[i] != cat {
                return None;
            }

            let name = &self.index.lower_names[i];
            let desc = &self.index.lower_descriptions[i];

            let score = compute_score(&q, name, desc, &t.tags);
            if score > 0.0 { Some((i, score)) } else { None }
        }).collect();

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let results: Vec<SearchResult> = scored.into_iter().take(50).map(|(i, score)| {
            SearchResult {
                id: self.index.tools[i].id.clone(),
                name: self.index.tools[i].name.clone(),
                category: self.index.tools[i].category.clone(),
                score,
            }
        }).collect();

        serde_wasm_bindgen::to_value(&results).unwrap_or(JsValue::NULL)
    }

    pub fn len(&self) -> usize {
        self.index.tools.len()
    }

    pub fn get_tool_ids(&self) -> JsValue {
        let ids: Vec<&str> = self.index.tools.iter().map(|t| t.id.as_str()).collect();
        serde_wasm_bindgen::to_value(&ids).unwrap_or(JsValue::NULL)
    }

    pub fn get_all_categories(&self) -> JsValue {
        let mut cats: Vec<&str> = self.index.lower_categories.iter().map(|s| s.as_str()).collect();
        cats.sort();
        cats.dedup();
        serde_wasm_bindgen::to_value(&cats).unwrap_or(JsValue::NULL)
    }
}

fn compute_score(query: &str, name: &str, desc: &str, tags: &[String]) -> f32 {
    if query.is_empty() {
        return 1.0;
    }

    let mut score: f32 = 0.0;

    // Exact name match
    if name == query {
        score += 100.0;
    }
    // Name starts with query
    else if name.starts_with(query) {
        score += 80.0;
    }
    // Name contains query
    else if name.contains(query) {
        score += 60.0;
    }

    // Prefix match (for partial typing)
    let query_chars: Vec<char> = query.chars().collect();
    let name_chars: Vec<char> = name.chars().collect();
    let mut prefix_score = 0.0_f32;
    let mut qi = 0;
    for &nc in &name_chars {
        if qi < query_chars.len() && nc == query_chars[qi] {
            prefix_score += 1.0;
            qi += 1;
        }
    }
    if qi == query_chars.len() && query_chars.len() > 0 {
        score += 40.0 * (prefix_score / name_chars.len() as f32);
    }

    // Tag match
    for tag in tags {
        let tag_lower = tag.to_lowercase();
        if tag_lower == query {
            score += 50.0;
        } else if tag_lower.contains(query) {
            score += 30.0;
        }
    }

    // Description match
    if desc.contains(query) {
        score += 10.0;
    }

    score
}
