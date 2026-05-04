use axum::{extract::{Path, Query, State}, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthUser;
use crate::AppState;

const PAGE_LIMIT_DEFAULT: i64 = 50;
const PAGE_LIMIT_MAX: i64 = 200;

#[derive(Deserialize)]
pub struct ListQuery {
    pub category: Option<String>,
    pub q: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// GET /api/v1/community/posts
pub async fn list_posts(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    let limit = q.limit.unwrap_or(PAGE_LIMIT_DEFAULT).clamp(1, PAGE_LIMIT_MAX);
    let offset = q.offset.unwrap_or(0).max(0);
    let category = q.category.as_deref().filter(|c| !c.is_empty() && !c.eq_ignore_ascii_case("all"));
    let search = q.q.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()).map(|s| format!("%{}%", s.to_lowercase()));

    // Total count for pagination
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM community_posts p
           WHERE ($1::text IS NULL OR p.category = $1)
             AND ($2::text IS NULL OR LOWER(p.title) LIKE $2 OR LOWER(p.content) LIKE $2)"#,
    )
    .bind(category)
    .bind(search.as_deref())
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let rows = sqlx::query_as::<_, (String, String, String, String, String, serde_json::Value, bool, i32, i32, i32, chrono::NaiveDateTime, Option<String>, Option<String>, Option<String>)>(
        r#"SELECT p.id, p.user_id, p.category, p.title, p.content, p.tags, p.pinned,
                  p.like_count, p.reply_count, p.view_count, p.created_at,
                  u.first_name, u.last_name, u.email
           FROM community_posts p
           JOIN users u ON u.id = p.user_id
           WHERE ($1::text IS NULL OR p.category = $1)
             AND ($2::text IS NULL OR LOWER(p.title) LIKE $2 OR LOWER(p.content) LIKE $2)
           ORDER BY p.pinned DESC, p.created_at DESC
           LIMIT $3 OFFSET $4"#,
    )
    .bind(category)
    .bind(search.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let posts: Vec<_> = rows.into_iter().map(|(id, user_id, category, title, content, tags, pinned, likes, replies, views, created_at, first_name, last_name, email)| {
        let author = match (first_name.as_deref().unwrap_or("").trim(), last_name.as_deref().unwrap_or("").trim()) {
            ("", "") => email.unwrap_or_else(|| "anonymous".into()).split('@').next().unwrap_or("anonymous").to_string(),
            (f, "") => f.to_string(),
            (f, l) => format!("{} {}", f, l),
        };
        json!({
            "id": id,
            "user_id": user_id,
            "author": author,
            "category": category,
            "title": title,
            "content": content,
            "tags": tags,
            "pinned": pinned,
            "like_count": likes,
            "reply_count": replies,
            "view_count": views,
            "created_at": created_at.and_utc().to_rfc3339(),
        })
    }).collect();

    Json(json!({
        "posts": posts,
        "page": { "total": total, "offset": offset, "limit": limit }
    })).into_response()
}

#[derive(Deserialize)]
pub struct CreatePostBody {
    pub title: String,
    pub content: String,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// POST /api/v1/community/posts
pub async fn create_post(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreatePostBody>,
) -> impl IntoResponse {
    let title = body.title.trim();
    let content = body.content.trim();
    if title.is_empty() || content.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error":"title and content are required"}))).into_response();
    }
    if title.len() > 200 || content.len() > 10_000 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error":"title or content too long"}))).into_response();
    }

    let id = Uuid::new_v4().to_string();
    let category = body.category.as_deref().unwrap_or("General").to_string();
    let tags = serde_json::to_value(body.tags.unwrap_or_default()).unwrap_or_else(|_| json!([]));

    let result = sqlx::query(
        r#"INSERT INTO community_posts (id, user_id, organization_id, category, title, content, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(user.org_id.as_deref())
    .bind(&category)
    .bind(title)
    .bind(content)
    .bind(&tags)
    .execute(&state.pool)
    .await;

    match result {
        Ok(_) => (StatusCode::CREATED, Json(json!({"id": id, "ok": true}))).into_response(),
        Err(e) => {
            tracing::error!("create_post failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db error"}))).into_response()
        }
    }
}

/// POST /api/v1/community/posts/:id/like  — toggles like
pub async fn toggle_like(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(post_id): Path<String>,
) -> impl IntoResponse {
    let mut tx = match state.pool.begin().await {
        Ok(t) => t,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"tx"}))).into_response(),
    };

    let existed: Option<(String,)> = sqlx::query_as(
        "SELECT post_id FROM community_post_likes WHERE post_id = $1 AND user_id = $2"
    )
    .bind(&post_id)
    .bind(&user.user_id)
    .fetch_optional(&mut *tx)
    .await
    .unwrap_or(None);

    let liked = if existed.is_some() {
        let _ = sqlx::query("DELETE FROM community_post_likes WHERE post_id = $1 AND user_id = $2")
            .bind(&post_id).bind(&user.user_id).execute(&mut *tx).await;
        let _ = sqlx::query("UPDATE community_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1")
            .bind(&post_id).execute(&mut *tx).await;
        false
    } else {
        let ok = sqlx::query("INSERT INTO community_post_likes (post_id, user_id) VALUES ($1, $2)")
            .bind(&post_id).bind(&user.user_id).execute(&mut *tx).await;
        if ok.is_err() {
            return (StatusCode::NOT_FOUND, Json(json!({"error":"post not found"}))).into_response();
        }
        let _ = sqlx::query("UPDATE community_posts SET like_count = like_count + 1 WHERE id = $1")
            .bind(&post_id).execute(&mut *tx).await;
        true
    };

    if tx.commit().await.is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"commit"}))).into_response();
    }

    let new_count: i32 = sqlx::query_scalar("SELECT like_count FROM community_posts WHERE id = $1")
        .bind(&post_id).fetch_one(&state.pool).await.unwrap_or(0);

    Json(json!({ "liked": liked, "like_count": new_count })).into_response()
}

/// GET /api/v1/community/stats
pub async fn get_stats(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let members: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE is_active = TRUE")
        .fetch_one(&state.pool).await.unwrap_or(0);
    let discussions: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM community_posts")
        .fetch_one(&state.pool).await.unwrap_or(0);
    let replies: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM community_post_replies")
        .fetch_one(&state.pool).await.unwrap_or(0);
    // "Online now" = users with last_login within last 15 minutes
    let online: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '15 minutes'")
        .fetch_one(&state.pool).await.unwrap_or(0);

    Json(json!({
        "members": members,
        "discussions": discussions,
        "replies": replies,
        "online_now": online,
    })).into_response()
}

/// GET /api/v1/community/leaderboard
/// Real ranking based on contribution score:
///   posts*5 + replies*2 + completed_scans*1
pub async fn get_leaderboard(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let rows = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>, i64, i64, i64)>(
        r#"
        SELECT u.id,
               u.first_name,
               u.last_name,
               u.email,
               COALESCE((SELECT COUNT(*) FROM community_posts p WHERE p.user_id = u.id), 0)::bigint AS posts,
               COALESCE((SELECT COUNT(*) FROM community_post_replies r WHERE r.user_id = u.id), 0)::bigint AS replies,
               COALESCE((SELECT COUNT(*) FROM scans s WHERE s.user_id = u.id AND s.status = 'completed'), 0)::bigint AS scans
        FROM users u
        WHERE u.is_active = TRUE
        ORDER BY (
            COALESCE((SELECT COUNT(*) FROM community_posts p WHERE p.user_id = u.id), 0) * 5 +
            COALESCE((SELECT COUNT(*) FROM community_post_replies r WHERE r.user_id = u.id), 0) * 2 +
            COALESCE((SELECT COUNT(*) FROM scans s WHERE s.user_id = u.id AND s.status = 'completed'), 0)
        ) DESC
        LIMIT 10
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let entries: Vec<_> = rows.into_iter().enumerate().map(|(i, (id, first, last, email, posts, replies, scans))| {
        let name = match (first.as_deref().unwrap_or("").trim(), last.as_deref().unwrap_or("").trim()) {
            ("", "") => email.unwrap_or_default().split('@').next().unwrap_or("anonymous").to_string(),
            (f, "") => f.to_string(),
            (f, l) => format!("{} {}", f, l),
        };
        let points = posts * 5 + replies * 2 + scans;
        let contributions = posts + replies + scans;
        json!({
            "rank": i + 1,
            "user_id": id,
            "name": name,
            "posts": posts,
            "replies": replies,
            "scans": scans,
            "contributions": contributions,
            "points": points,
        })
    }).collect();

    Json(json!({ "leaderboard": entries })).into_response()
}

/// GET /api/v1/community/me/rank
pub async fn get_my_rank(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Compute my points
    let row: Option<(i64, i64, i64)> = sqlx::query_as(
        r#"SELECT
            COALESCE((SELECT COUNT(*) FROM community_posts p WHERE p.user_id = $1), 0)::bigint,
            COALESCE((SELECT COUNT(*) FROM community_post_replies r WHERE r.user_id = $1), 0)::bigint,
            COALESCE((SELECT COUNT(*) FROM scans s WHERE s.user_id = $1 AND s.status = 'completed'), 0)::bigint
        "#,
    )
    .bind(&user.user_id)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let (posts, replies, scans) = row.unwrap_or((0, 0, 0));
    let my_points = posts * 5 + replies * 2 + scans;
    let contributions = posts + replies + scans;

    // Rank = 1 + count of active users with strictly higher score
    let rank: i64 = sqlx::query_scalar(
        r#"
        SELECT 1 + COUNT(*) FROM (
            SELECT (
                COALESCE((SELECT COUNT(*) FROM community_posts p WHERE p.user_id = u.id), 0) * 5 +
                COALESCE((SELECT COUNT(*) FROM community_post_replies r WHERE r.user_id = u.id), 0) * 2 +
                COALESCE((SELECT COUNT(*) FROM scans s WHERE s.user_id = u.id AND s.status = 'completed'), 0)
            ) AS score FROM users u WHERE u.is_active = TRUE AND u.id <> $1
        ) sub WHERE sub.score > $2
        "#,
    )
    .bind(&user.user_id)
    .bind(my_points)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    Json(json!({
        "rank": rank,
        "points": my_points,
        "contributions": contributions,
        "posts": posts,
        "replies": replies,
        "scans": scans,
    })).into_response()
}
