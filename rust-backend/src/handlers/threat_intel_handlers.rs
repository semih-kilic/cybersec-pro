use axum::{extract::{Query, State}, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::services::threat_intel;
use crate::AppState;

#[derive(Deserialize)]
pub struct IntelQuery {
    pub refresh: Option<bool>,
    pub q: Option<String>,
    pub ioc_type: Option<String>,
}

pub async fn get_threat_intel(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Query(q): Query<IntelQuery>,
) -> impl IntoResponse {
    let force = q.refresh.unwrap_or(false);
    let mut intel = threat_intel::get_intel(force).await;

    if let Some(query) = q.q.as_deref() {
        let needle = query.to_lowercase();
        if !needle.is_empty() {
            intel.iocs.retain(|i| {
                i.value.to_lowercase().contains(&needle)
                    || i.threat.to_lowercase().contains(&needle)
                    || i.ioc_type.to_lowercase().contains(&needle)
            });
        }
    }
    if let Some(t) = q.ioc_type.as_deref() {
        if !t.is_empty() && !t.eq_ignore_ascii_case("all") {
            intel.iocs.retain(|i| i.ioc_type.eq_ignore_ascii_case(t));
        }
    }

    // APT groups: real curated MITRE ATT&CK reference data (not faked counts)
    let apt_groups = json!([
        {"name":"APT28 (Fancy Bear)","mitre_id":"G0007","origin":"Russia","targets":"Government, Military, Media","ttps":["Spear Phishing","Zero-day Exploits","Credential Harvesting"],"reference":"https://attack.mitre.org/groups/G0007/"},
        {"name":"APT29 (Cozy Bear)","mitre_id":"G0016","origin":"Russia","targets":"Government, Think Tanks, Healthcare","ttps":["Supply Chain","Cloud Exploitation","Custom Malware"],"reference":"https://attack.mitre.org/groups/G0016/"},
        {"name":"APT41 (Double Dragon)","mitre_id":"G0096","origin":"China","targets":"Technology, Healthcare, Telecom","ttps":["Supply Chain","Rootkits","Code Signing"],"reference":"https://attack.mitre.org/groups/G0096/"},
        {"name":"Lazarus Group","mitre_id":"G0032","origin":"North Korea","targets":"Financial, Cryptocurrency, Government","ttps":["Watering Hole","Custom Trojans","Cryptocurrency Theft"],"reference":"https://attack.mitre.org/groups/G0032/"},
        {"name":"APT33 (Elfin)","mitre_id":"G0064","origin":"Iran","targets":"Aerospace, Energy, Government","ttps":["Spear Phishing","Destructive Malware","Password Spraying"],"reference":"https://attack.mitre.org/groups/G0064/"},
        {"name":"FIN7","mitre_id":"G0046","origin":"Eastern Europe","targets":"Retail, Hospitality, Financial","ttps":["Phishing","POS Malware","Social Engineering"],"reference":"https://attack.mitre.org/groups/G0046/"},
        {"name":"Volt Typhoon","mitre_id":"G1017","origin":"China","targets":"Critical Infrastructure, Telecom","ttps":["Living-off-the-Land","VPN Exploitation","Lateral Movement"],"reference":"https://attack.mitre.org/groups/G1017/"},
        {"name":"Sandworm","mitre_id":"G0034","origin":"Russia","targets":"Energy, Government, Industrial","ttps":["Destructive Malware","ICS Attacks","Wiper Deployment"],"reference":"https://attack.mitre.org/groups/G0034/"}
    ]);

    Json(json!({
        "feeds": intel.feeds,
        "iocs": intel.iocs,
        "stats": intel.stats,
        "apt_groups": apt_groups,
        "fetched_at": intel.fetched_at,
    })).into_response()
}
