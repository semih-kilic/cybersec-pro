use axum::{extract::{Path, Query, State}, http::StatusCode, response::IntoResponse, Json};
use chrono::NaiveDateTime;
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

type PostRow = (
    String,                  // id
    String,                  // user_id
    String,                  // category
    String,                  // title
    String,                  // content
    serde_json::Value,       // tags
    bool,                    // pinned
    i32,                     // like_count
    i32,                     // reply_count
    i32,                     // view_count
    NaiveDateTime,           // created_at
    Option<String>,          // first_name
    Option<String>,          // last_name
    Option<String>,          // email
);

fn display_author(first: Option<&str>, last: Option<&str>, email: Option<&str>) -> String {
    let f = first.unwrap_or("").trim();
    let l = last.unwrap_or("").trim();
    if !f.is_empty() && !l.is_empty() {
        format!("{} {}", f, l)
    } else if !f.is_empty() {
        f.to_string()
    } else if !l.is_empty() {
        l.to_string()
    } else {
        email.unwrap_or("anonymous").split('@').next().unwrap_or("anonymous").to_string()
    }
}

/// GET /api/v1/community/posts
pub async fn list_posts(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    let limit = q.limit.unwrap_or(PAGE_LIMIT_DEFAULT).clamp(1, PAGE_LIMIT_MAX);
    let offset = q.offset.unwrap_or(0).max(0);
    let category: Option<String> = q.category.as_deref()
        .filter(|c| !c.is_empty() && !c.eq_ignore_ascii_case("all"))
        .map(|s| s.to_string());
    let search: Option<String> = q.q.as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| format!("%{}%", s.to_lowercase()));

    let total_row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM community_posts p \
         WHERE ($1::text IS NULL OR p.category = $1) \
           AND ($2::text IS NULL OR LOWER(p.title) LIKE $2 OR LOWER(p.content) LIKE $2)",
    )
    .bind(&category)
    .bind(&search)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));
    let total = total_row.0;

    let rows: Vec<PostRow> = sqlx::query_as(
        "SELECT p.id, p.user_id, p.category, p.title, p.content, p.tags, p.pinned, \
                p.like_count, p.reply_count, p.view_count, p.created_at, \
                u.first_name, u.last_name, u.email \
         FROM community_posts p \
         JOIN users u ON u.id = p.user_id \
         WHERE ($1::text IS NULL OR p.category = $1) \
           AND ($2::text IS NULL OR LOWER(p.title) LIKE $2 OR LOWER(p.content) LIKE $2) \
         ORDER BY p.pinned DESC, p.created_at DESC \
         LIMIT $3 OFFSET $4",
    )
    .bind(&category)
    .bind(&search)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let posts: Vec<_> = rows.into_iter().map(|r| {
        let (id, user_id, category, title, content, tags, pinned, likes, replies, views, created_at, first, last, email) = r;
        let author = display_author(first.as_deref(), last.as_deref(), email.as_deref());
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
    let tags_json = serde_json::to_value(body.tags.unwrap_or_default()).unwrap_or_else(|_| json!([]));

    let result = sqlx::query(
        "INSERT INTO community_posts (id, user_id, organization_id, category, title, content, tags) \
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(user.org_id.as_deref().map(|s| s.to_string()))
    .bind(&category)
    .bind(title.to_string())
    .bind(content.to_string())
    .bind(&tags_json)
    .execute(&state.db)
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
    let mut tx = match state.db.begin().await {
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

    let count_row: (i32,) = sqlx::query_as("SELECT like_count FROM community_posts WHERE id = $1")
        .bind(&post_id).fetch_one(&state.db).await.unwrap_or((0,));

    Json(json!({ "liked": liked, "like_count": count_row.0 })).into_response()
}

/// GET /api/v1/community/stats
pub async fn get_stats(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let members_row: (i64,) = sqlx::query_as("SELECT COUNT(*)::bigint FROM users WHERE is_active = TRUE")
        .fetch_one(&state.db).await.unwrap_or((0,));
    let discussions_row: (i64,) = sqlx::query_as("SELECT COUNT(*)::bigint FROM community_posts")
        .fetch_one(&state.db).await.unwrap_or((0,));
    let replies_row: (i64,) = sqlx::query_as("SELECT COUNT(*)::bigint FROM community_post_replies")
        .fetch_one(&state.db).await.unwrap_or((0,));
    let online_row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM users WHERE last_login > NOW() - INTERVAL '15 minutes'"
    ).fetch_one(&state.db).await.unwrap_or((0,));

    Json(json!({
        "members": members_row.0,
        "discussions": discussions_row.0,
        "replies": replies_row.0,
        "online_now": online_row.0,
    })).into_response()
}

type LbRow = (
    String,         // id
    Option<String>, // first_name
    Option<String>, // last_name
    Option<String>, // email
    i64,            // posts
    i64,            // replies
    i64,            // scans
);

/// GET /api/v1/community/leaderboard
/// Real ranking: posts*5 + replies*2 + completed_scans*1
pub async fn get_leaderboard(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let rows: Vec<LbRow> = sqlx::query_as(
        "SELECT u.id, u.first_name, u.last_name, u.email, \
                COALESCE((SELECT COUNT(*) FROM community_posts p WHERE p.user_id = u.id), 0)::bigint, \
                COALESCE((SELECT COUNT(*) FROM community_post_replies r WHERE r.user_id = u.id), 0)::bigint, \
                COALESCE((SELECT COUNT(*) FROM scans s WHERE s.user_id = u.id AND s.status = 'completed'), 0)::bigint \
         FROM users u \
         WHERE u.is_active = TRUE \
         ORDER BY ( \
            COALESCE((SELECT COUNT(*) FROM community_posts p WHERE p.user_id = u.id), 0) * 5 + \
            COALESCE((SELECT COUNT(*) FROM community_post_replies r WHERE r.user_id = u.id), 0) * 2 + \
            COALESCE((SELECT COUNT(*) FROM scans s WHERE s.user_id = u.id AND s.status = 'completed'), 0) \
         ) DESC \
         LIMIT 10",
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let entries: Vec<_> = rows.into_iter().enumerate().map(|(i, r)| {
        let (id, first, last, email, posts, replies, scans) = r;
        let name = display_author(first.as_deref(), last.as_deref(), email.as_deref());
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
    let row: Option<(i64, i64, i64)> = sqlx::query_as(
        "SELECT \
            COALESCE((SELECT COUNT(*) FROM community_posts p WHERE p.user_id = $1), 0)::bigint, \
            COALESCE((SELECT COUNT(*) FROM community_post_replies r WHERE r.user_id = $1), 0)::bigint, \
            COALESCE((SELECT COUNT(*) FROM scans s WHERE s.user_id = $1 AND s.status = 'completed'), 0)::bigint",
    )
    .bind(&user.user_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (posts, replies, scans) = row.unwrap_or((0, 0, 0));
    let my_points = posts * 5 + replies * 2 + scans;
    let contributions = posts + replies + scans;

    let rank_row: (i64,) = sqlx::query_as(
        "SELECT 1 + COUNT(*)::bigint FROM ( \
            SELECT ( \
                COALESCE((SELECT COUNT(*) FROM community_posts p WHERE p.user_id = u.id), 0) * 5 + \
                COALESCE((SELECT COUNT(*) FROM community_post_replies r WHERE r.user_id = u.id), 0) * 2 + \
                COALESCE((SELECT COUNT(*) FROM scans s WHERE s.user_id = u.id AND s.status = 'completed'), 0) \
            ) AS score FROM users u WHERE u.is_active = TRUE AND u.id <> $1 \
         ) sub WHERE sub.score > $2",
    )
    .bind(&user.user_id)
    .bind(my_points)
    .fetch_one(&state.db)
    .await
    .unwrap_or((1,));

    Json(json!({
        "rank": rank_row.0,
        "points": my_points,
        "contributions": contributions,
        "posts": posts,
        "replies": replies,
        "scans": scans,
    })).into_response()
}
