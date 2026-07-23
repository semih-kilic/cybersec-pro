use redis::{AsyncCommands, Client};
use std::sync::Arc;
use std::time::Duration;

/// Redis-backed cache service
#[derive(Clone)]
pub struct CacheService {
    client: Client,
}

impl CacheService {
    /// Create new cache service with Redis connection
    pub async fn new(redis_url: &str) -> anyhow::Result<Self> {
        let client = Client::open(redis_url)?;
        // Test connection
        let mut conn = client.get_multiplexed_async_connection().await?;
        let _: String = redis::cmd("PING").query_async(&mut conn).await?;
        Ok(Self { client })
    }

    /// Get a connection from the pool
    async fn conn(&self) -> anyhow::Result<redis::aio::MultiplexedConnection> {
        Ok(self.client.get_multiplexed_async_connection().await?)
    }

    /// Get value from cache
    pub async fn get(&self, key: &str) -> anyhow::Result<Option<String>> {
        let mut conn = self.conn().await?;
        Ok(conn.get(key).await.ok())
    }

    /// Set value in cache with TTL
    pub async fn set(&self, key: &str, value: &str, ttl: Duration) -> anyhow::Result<()> {
        let mut conn = self.conn().await?;
        conn.set_ex(key, value, ttl.as_secs()).await?;
        Ok(())
    }

    /// Set value in cache without TTL (persistent)
    pub async fn set_permanent(&self, key: &str, value: &str) -> anyhow::Result<()> {
        let mut conn = self.conn().await?;
        conn.set(key, value).await?;
        Ok(())
    }

    /// Delete key from cache
    pub async fn delete(&self, key: &str) -> anyhow::Result<()> {
        let mut conn = self.conn().await?;
        conn.del(key).await?;
        Ok(())
    }

    /// Delete multiple keys matching pattern
    pub async fn delete_pattern(&self, pattern: &str) -> anyhow::Result<()> {
        let mut conn = self.conn().await?;
        let keys: Vec<String> = conn.keys(pattern).await?;
        if !keys.is_empty() {
            conn.del(&keys).await?;
        }
        Ok(())
    }

    /// Check if key exists
    pub async fn exists(&self, key: &str) -> anyhow::Result<bool> {
        let mut conn = self.conn().await?;
        Ok(conn.exists(key).await.unwrap_or(false))
    }

    /// Get TTL for key
    pub async fn ttl(&self, key: &str) -> anyhow::Result<Option<i64>> {
        let mut conn = self.conn().await?;
        Ok(conn.ttl(key).await.ok())
    }

    /// Increment counter
    pub async fn incr(&self, key: &str) -> anyhow::Result<i64> {
        let mut conn = self.conn().await?;
        Ok(conn.incr(key).await?)
    }

    /// Increment with TTL
    pub async fn incr_with_ttl(&self, key: &str, ttl: Duration) -> anyhow::Result<i64> {
        let mut conn = self.conn().await?;
        let count: i64 = conn.incr(key).await?;
        if count == 1 {
            conn.expire(key, ttl.as_secs() as usize).await?;
        }
        Ok(count)
    }

    /// Get multiple values at once
    pub async fn mget(&self, keys: &[&str]) -> anyhow::Result<Vec<Option<String>>> {
        let mut conn = self.conn().await?;
        Ok(conn.mget(keys).await?)
    }

    /// Set multiple values at once
    pub async fn mset(&self, pairs: &[(&str, &str)]) -> anyhow::Result<()> {
        let mut conn = self.conn().await?;
        let flat: Vec<&str> = pairs.iter().flat_map(|(k, v)| vec![*k, *v]).collect();
        conn.mset(&flat).await?;
        Ok(())
    }

    /// Health check
    pub async fn health_check(&self) -> anyhow::Result<bool> {
        let mut conn = self.conn().await?;
        let result: Result<String, _> = redis::cmd("PING").query_async(&mut conn).await;
        Ok(result.is_ok())
    }
}

/// Cache key builders for consistent naming
pub mod keys {
    /// Tool list cache key
    pub fn tools_list(page: u32, per_page: u32, search: Option<&str>) -> String {
        match search {
            Some(s) => format!("tools:list:{}:{}:search:{}", page, per_page, s),
            None => format!("tools:list:{}:{}", page, per_page),
        }
    }

    /// Single tool detail
    pub fn tool_detail(tool_id: &str) -> String {
        format!("tool:detail:{}", tool_id)
    }

    /// Tool count
    pub fn tools_count() -> String {
        "tools:count".to_string()
    }

    /// Scan result
    pub fn scan_result(scan_id: &str) -> String {
        format!("scan:result:{}", scan_id)
    }

    /// Scan list for user/org
    pub fn scans_list(org_id: &str, page: u32, per_page: u32) -> String {
        format!("scans:list:{}:{}:{}", org_id, page, per_page)
    }

    /// User session
    pub fn user_session(user_id: &str) -> String {
        format!("session:{}", user_id)
    }

    /// Rate limit counter
    pub fn rate_limit(key: &str) -> String {
        format!("ratelimit:{}", key)
    }

    /// Tool by category
    pub fn tools_by_category(category: &str) -> String {
        format!("tools:category:{}", category)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cache_basic() {
        let cache = CacheService::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        cache.set("test_key", "test_value", std::time::Duration::from_secs(60))
            .await
            .expect("Set failed");

        let value = cache.get("test_key").await.expect("Get failed");
        assert_eq!(value, Some("test_value".to_string()));

        cache.delete("test_key").await.expect("Delete failed");
        let value = cache.get("test_key").await.expect("Get failed");
        assert_eq!(value, None);
    }
}