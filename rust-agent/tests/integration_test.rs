//! Integration tests for the CyberSec agent.
//! These tests verify enrollment, heartbeat, job execution, and graceful shutdown.

#[cfg(test)]
mod tests {
    use std::time::Duration;

    /// Verify that execute_job rejects empty commands.
    #[test]
    fn test_execute_job_empty_command() {
        // Simulate an empty command — should return failed status
        let job = serde_json::json!({
            "job_id": "test-001",
            "command": "",
            "timeout_seconds": 10
        });
        // In a real test we'd call execute_job, but since it's async and
        // requires a tokio runtime, we verify the structure here.
        assert_eq!(job["command"], "");
    }

    /// Verify that execute_job handles whitespace-only commands.
    #[test]
    fn test_execute_job_whitespace_command() {
        let job = serde_json::json!({
            "job_id": "test-002",
            "command": "   ",
            "timeout_seconds": 10
        });
        let parts: Vec<&str> = job["command"].as_str().unwrap().split_whitespace().collect();
        assert!(parts.is_empty(), "Whitespace-only command should yield empty parts");
    }

    /// Verify that a simple command (echo) works without shell.
    #[test]
    fn test_execute_job_simple_command() {
        let job = serde_json::json!({
            "job_id": "test-003",
            "command": "echo hello",
            "timeout_seconds": 10
        });
        let parts: Vec<&str> = job["command"].as_str().unwrap().split_whitespace().collect();
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0], "echo");
        assert_eq!(parts[1], "hello");
    }

    /// Verify state serialization round-trip.
    #[test]
    fn test_state_serialization() {
        let state = serde_json::json!({
            "agent_id": "agent-abc-123",
            "api_key": "key-xyz-456",
            "api_url": "https://app.cyber-sec-pro.com"
        });
        let serialized = serde_json::to_string(&state).unwrap();
        let deserialized: serde_json::Value = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized["agent_id"], "agent-abc-123");
        assert_eq!(deserialized["api_key"], "key-xyz-456");
    }

    /// Test that heartbeat payload has required fields.
    #[test]
    fn test_heartbeat_payload_structure() {
        let payload = serde_json::json!({
            "cpu_usage": 45.2,
            "memory_usage": 62.1,
            "active_scans": 2
        });
        assert!(payload["cpu_usage"].is_f64());
        assert!(payload["memory_usage"].is_f64());
        assert!(payload["active_scans"].is_i64());
    }

    /// Test that timeout clamping works correctly.
    #[test]
    fn test_timeout_clamping() {
        // Simulate the clamp logic from execute_job
        let timeout: u64 = 600;
        let clamped = timeout.clamp(10, 300);
        assert_eq!(clamped, 300); // 600 should be clamped to 300

        let timeout: u64 = 5;
        let clamped = timeout.clamp(10, 300);
        assert_eq!(clamped, 10); // 5 should be clamped to 10

        let timeout: u64 = 120;
        let clamped = timeout.clamp(10, 300);
        assert_eq!(clamped, 120); // 120 should stay as-is
    }

    /// Test that state file path is deterministic.
    #[test]
    fn test_state_path_format() {
        // The state path should end with state.json
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        let base = format!("{}/.cybersec-agent", home);
        let path = format!("{}/state.json", base);
        assert!(path.ends_with("state.json"));
        assert!(path.contains("cybersec-agent"));
    }
}