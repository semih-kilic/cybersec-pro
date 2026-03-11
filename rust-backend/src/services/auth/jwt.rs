use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,        // user_id
    pub org: Option<String>, // organization_id
    pub role: String,
    pub exp: i64,
    pub iat: i64,
    pub token_type: String, // "access" or "refresh"
    pub fresh: bool,        // Flask-JWT-Extended compatibility
}

pub fn create_access_token(
    secret: &str,
    user_id: &str,
    org_id: Option<&str>,
    role: &str,
) -> anyhow::Result<String> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        org: org_id.map(|s| s.to_string()),
        role: role.to_string(),
        exp: (now + Duration::hours(1)).timestamp(),
        iat: now.timestamp(),
        token_type: "access".to_string(),
        fresh: true,
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;
    Ok(token)
}

pub fn create_refresh_token(
    secret: &str,
    user_id: &str,
) -> anyhow::Result<String> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        org: None,
        role: String::new(),
        exp: (now + Duration::days(30)).timestamp(),
        iat: now.timestamp(),
        token_type: "refresh".to_string(),
        fresh: false,
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;
    Ok(token)
}

pub fn decode_token(secret: &str, token: &str) -> anyhow::Result<Claims> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}
