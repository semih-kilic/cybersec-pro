use axum::{extract::{Query, State}, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::services::news_feed;
use crate::AppState;

#[derive(Deserialize)]
pub struct NewsQuery {
    pub category: Option<String>,
    pub source: Option<String>,
    pub q: Option<String>,
    pub limit: Option<usize>,
    pub refresh: Option<bool>,
}

pub async fn list_security_news(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Query(q): Query<NewsQuery>,
) -> impl IntoResponse {
    let force = q.refresh.unwrap_or(false);
    let mut items = news_feed::get_news(force).await;

    if let Some(cat) = q.category.as_deref() {
        if !cat.is_empty() && !cat.eq_ignore_ascii_case("all") {
            items.retain(|i| i.category.eq_ignore_ascii_case(cat));
        }
    }
    if let Some(src) = q.source.as_deref() {
        if !src.is_empty() {
            items.retain(|i| i.source.eq_ignore_ascii_case(src));
        }
    }
    if let Some(query) = q.q.as_deref() {
        let needle = query.to_lowercase();
        if !needle.is_empty() {
            items.retain(|i| {
                i.title.to_lowercase().contains(&needle)
                    || i.summary.to_lowercase().contains(&needle)
                    || i.tags.iter().any(|t| t.to_lowercase().contains(&needle))
            });
        }
    }

    let limit = q.limit.unwrap_or(50).min(100);
    items.truncate(limit);

    let categories = ["All", "Breaches", "Vulnerabilities", "Malware", "Policy", "Research", "Tools"];
    let sources = ["BleepingComputer", "The Hacker News", "Krebs on Security", "Dark Reading", "CISA Alerts", "SANS ISC"];

    Json(json!({
        "items": items,
        "categories": categories,
        "sources": sources,
        "count": items.len(),
    })).into_response()
}
