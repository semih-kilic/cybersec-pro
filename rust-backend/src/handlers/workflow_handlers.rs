//! Scan Workflows ("playbooks"): a named bundle of curated tools that run
//! sequentially against ONE target, so a user gets a full assessment from a
//! single click instead of launching each tool by hand. The client
//! orchestrates the steps (it already owns scan launch + live output), so this
//! module only *defines* the playbooks and serves them; each step reuses the
//! normal, fully-guarded scan path (auth, authorization, whitelist, limits).
//!
//! Step `params` use the SAME whitelisted option values as the tools' own
//! forms, so the backend argument-injection guard accepts them unchanged.

use axum::{extract::Path, response::IntoResponse, Json};
use serde_json::json;

/// Every workflow, as JSON the client renders and then runs step by step.
/// Kept as one data blob so the catalogue is reviewable at a glance.
fn workflows_json() -> serde_json::Value {
    json!([
        {
            "id": "web-full",
            "name": "Tam Web Denetimi",
            "description": "Bir web hedefini uçtan uca tarar: teknoloji tespiti, canlılık, bilinen zafiyetler ve sunucu hijyeni.",
            "category": "Web Application Security",
            "icon": "🌐",
            "danger": "medium",
            "target_types": ["url", "domain"],
            "steps": [
                {"tool": "whatweb", "label": "Teknoloji tespiti", "params": {"aggression": "-a 1"}},
                {"tool": "httpx", "label": "Canlılık + başlık + teknoloji", "params": {"status_code": "-sc", "title": "-title", "tech_detect": "-td", "web_server": "", "follow_redirects": ""}},
                {"tool": "nuclei", "label": "Bilinen zafiyet taraması", "params": {"severity": "-severity medium,high,critical", "tags": "", "rate_limit": "-rl 150"}},
                {"tool": "nikto", "label": "Web sunucusu hijyeni", "params": {"ssl": "", "tuning": ""}}
            ]
        },
        {
            "id": "recon-subdomains",
            "name": "Alt Alan Adı Keşfi",
            "description": "Bir alan adının dışa dönük tüm alt alan adlarını çok sayıda pasif kaynaktan derler.",
            "category": "Reconnaissance & OSINT",
            "icon": "🔎",
            "danger": "low",
            "target_types": ["domain"],
            "steps": [
                {"tool": "subfinder", "label": "Pasif alt alan adı toplama", "params": {}},
                {"tool": "amass", "label": "Çoklu-kaynak alt alan adı", "params": {"mode": "-passive"}},
                {"tool": "assetfinder", "label": "Ek varlık keşfi", "params": {"subs_only": "--subs-only"}}
            ]
        },
        {
            "id": "wordpress-audit",
            "name": "WordPress Denetimi",
            "description": "WordPress tabanlı bir siteyi sürüm, savunmasız eklenti/tema ve yaygın açıklar için tarar.",
            "category": "Web Application Security",
            "icon": "📝",
            "danger": "medium",
            "target_types": ["url", "domain"],
            "steps": [
                {"tool": "whatweb", "label": "WordPress doğrulama", "params": {"aggression": "-a 1"}},
                {"tool": "wpscan", "label": "WordPress zafiyet taraması", "params": {"enumerate": "-e vp,vt,u", "detection": "--detection-mode passive"}},
                {"tool": "nuclei", "label": "WordPress şablonları", "params": {"severity": "-severity medium,high,critical", "tags": "", "rate_limit": "-rl 150"}}
            ]
        },
        {
            "id": "tls-audit",
            "name": "TLS/SSL Denetimi",
            "description": "Bir HTTPS servisinin şifreleme hijyenini denetler: zayıf protokoller, şifreler ve sertifika sorunları.",
            "category": "Compliance & Regulatory",
            "icon": "🔒",
            "danger": "low",
            "target_types": ["url", "domain", "ip"],
            "steps": [
                {"tool": "tlsx", "label": "Sertifika + TLS bilgisi", "params": {"mode": "-san -cn"}},
                {"tool": "testssl", "label": "Derin TLS/SSL denetimi", "params": {"severity": "LOW", "protocols": ""}},
                {"tool": "nuclei", "label": "SSL yanlış yapılandırma şablonları", "params": {"severity": "-severity medium,high,critical", "tags": "", "rate_limit": "-rl 150"}}
            ]
        },
        {
            "id": "network-host",
            "name": "Ağ Hostu Taraması",
            "description": "Bir IP/host üzerindeki açık portları, servisleri ve temel zafiyetleri haritalar.",
            "category": "Reconnaissance & OSINT",
            "icon": "🖧",
            "danger": "medium",
            "target_types": ["ip", "domain", "network"],
            "steps": [
                {"tool": "naabu", "label": "Hızlı port keşfi", "params": {"ports": "1000", "scan_type": "CONNECT"}},
                {"tool": "nmap", "label": "Servis + sürüm tespiti", "params": {"scan_type": "-sT", "timing": "-T4", "port_spec": "--top-ports 1000", "service_detection": "-sV", "os_detection": "", "script_scan": ""}}
            ]
        },
        {
            "id": "osint-footprint",
            "name": "Kurumsal Dış İz (OSINT)",
            "description": "Bir alan adının açık kaynak izini çıkarır: e-postalar, alt alan adları, arşiv URL'leri ve WHOIS.",
            "category": "Reconnaissance & OSINT",
            "icon": "🕵️",
            "danger": "low",
            "target_types": ["domain"],
            "steps": [
                {"tool": "whois", "label": "Kayıt bilgisi", "params": {}},
                {"tool": "theHarvester", "label": "E-posta + alt alan adı toplama", "params": {"source": "crtsh", "limit": "200"}},
                {"tool": "waybackurls", "label": "Arşivlenmiş URL'ler", "params": {}}
            ]
        }
    ])
}

/// GET /api/v1/workflows — list every workflow definition.
pub async fn list_workflows() -> impl IntoResponse {
    Json(json!({ "workflows": workflows_json() }))
}

/// GET /api/v1/workflows/:id — one workflow, or 404.
pub async fn get_workflow(Path(id): Path<String>) -> impl IntoResponse {
    if let Some(arr) = workflows_json().as_array() {
        if let Some(wf) = arr.iter().find(|w| w.get("id").and_then(|v| v.as_str()) == Some(id.as_str())) {
            return Json(wf.clone()).into_response();
        }
    }
    (axum::http::StatusCode::NOT_FOUND, Json(json!({"error": "Workflow not found"}))).into_response()
}
