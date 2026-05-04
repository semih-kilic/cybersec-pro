//! # Connection Engine — CyberSec Pro
//!
//! Real SSH/TCP connection management for agent devices.
//! Supports: SSH password auth, SSH key auth, TCP port scan.

use std::io::Read;
use std::net::TcpStream;
use std::path::Path;
use std::time::Duration;
use ssh2::Session;
use tracing::info;

/// Result of a connection test
#[derive(Debug, Clone, serde::Serialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub connection_type: String,
    pub hostname: Option<String>,
    pub os_info: Option<String>,
    pub kernel: Option<String>,
    pub uptime: Option<String>,
    pub cpu_cores: Option<i32>,
    pub memory_total_mb: Option<i64>,
    pub memory_used_mb: Option<i64>,
    pub disk_total_gb: Option<i64>,
    pub disk_used_gb: Option<i64>,
    pub ip_addresses: Vec<String>,
    pub open_ports: Vec<u16>,
    pub latency_ms: f64,
    pub error: Option<String>,
    pub ssh_banner: Option<String>,
}

impl Default for ConnectionTestResult {
    fn default() -> Self {
        Self {
            success: false,
            connection_type: "ssh".into(),
            hostname: None,
            os_info: None,
            kernel: None,
            uptime: None,
            cpu_cores: None,
            memory_total_mb: None,
            memory_used_mb: None,
            disk_total_gb: None,
            disk_used_gb: None,
            ip_addresses: vec![],
            open_ports: vec![],
            latency_ms: 0.0,
            error: None,
            ssh_banner: None,
        }
    }
}

/// Result of command execution on remote device
#[derive(Debug, Clone, serde::Serialize)]
pub struct CommandResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
}

/// SSH connection parameters
pub struct SshConnParams {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub passphrase: Option<String>,
    pub timeout_secs: u64,
}

/// Test SSH connection and gather system info
pub async fn test_ssh_connection(params: &SshConnParams) -> ConnectionTestResult {
    // Run in blocking thread since ssh2 is sync
    let host = params.host.clone();
    let port = params.port;
    let username = params.username.clone();
    let password = params.password.clone();
    let private_key = params.private_key.clone();
    let passphrase = params.passphrase.clone();
    let timeout = params.timeout_secs;

    tokio::task::spawn_blocking(move || {
        test_ssh_connection_sync(&host, port, &username, password.as_deref(), private_key.as_deref(), passphrase.as_deref(), timeout)
    })
    .await
    .unwrap_or_else(|e| {
        let mut r = ConnectionTestResult::default();
        r.error = Some(format!("Task panicked: {}", e));
        r
    })
}

fn test_ssh_connection_sync(
    host: &str,
    port: u16,
    username: &str,
    password: Option<&str>,
    private_key: Option<&str>,
    passphrase: Option<&str>,
    timeout_secs: u64,
) -> ConnectionTestResult {
    let mut result = ConnectionTestResult::default();
    let start = std::time::Instant::now();

    // Step 1: TCP Connect
    let addr = format!("{}:{}", host, port);
    let tcp = match TcpStream::connect_timeout(
        &addr.parse().unwrap_or_else(|_| {
            use std::net::ToSocketAddrs;
            addr.to_socket_addrs()
                .ok()
                .and_then(|mut addrs| addrs.next())
                .unwrap_or_else(|| "0.0.0.0:22".parse().unwrap())
        }),
        Duration::from_secs(timeout_secs),
    ) {
        Ok(tcp) => {
            tcp.set_read_timeout(Some(Duration::from_secs(timeout_secs))).ok();
            tcp.set_write_timeout(Some(Duration::from_secs(timeout_secs))).ok();
            tcp
        }
        Err(e) => {
            result.error = Some(format!("TCP connection failed to {}:{} — {}", host, port, e));
            result.latency_ms = start.elapsed().as_secs_f64() * 1000.0;
            return result;
        }
    };

    result.latency_ms = start.elapsed().as_secs_f64() * 1000.0;

    // Step 2: SSH Handshake
    let mut session = match Session::new() {
        Ok(s) => s,
        Err(e) => {
            result.error = Some(format!("SSH session init failed: {}", e));
            return result;
        }
    };

    session.set_tcp_stream(tcp);
    session.set_timeout((timeout_secs * 1000) as u32);

    if let Err(e) = session.handshake() {
        result.error = Some(format!("SSH handshake failed: {}", e));
        return result;
    }

    // Capture SSH banner
    if let Some(banner) = session.banner() {
        result.ssh_banner = Some(banner.to_string());
    }

    // Step 3: Authenticate
    let auth_ok = if let Some(key_data) = private_key {
        // Try key-based auth
        if Path::new(&key_data).exists() {
            // It's a file path
            session.userauth_pubkey_file(username, None, Path::new(&key_data), passphrase).is_ok()
        } else {
            // It's inline key content
            session.userauth_pubkey_memory(username, None, &key_data, passphrase).is_ok()
        }
    } else if let Some(pwd) = password {
        session.userauth_password(username, pwd).is_ok()
    } else {
        // Try agent auth
        session.userauth_agent(username).is_ok()
    };

    if !auth_ok || !session.authenticated() {
        result.error = Some("SSH authentication failed — check username/password/key".into());
        return result;
    }

    result.success = true;
    info!("✅ SSH connected to {}@{}:{}", username, host, port);

    // Step 4: Gather system info
    result.hostname = exec_cmd(&session, "hostname").ok().map(|s| s.trim().to_string());
    result.os_info = exec_cmd(&session, "cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'\"' -f2 || uname -s").ok().map(|s| s.trim().to_string());
    result.kernel = exec_cmd(&session, "uname -r").ok().map(|s| s.trim().to_string());
    result.uptime = exec_cmd(&session, "uptime -p 2>/dev/null || uptime").ok().map(|s| s.trim().to_string());

    // CPU cores
    if let Ok(cores_str) = exec_cmd(&session, "nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 0") {
        result.cpu_cores = cores_str.trim().parse().ok();
    }

    // Memory info (in MB)
    if let Ok(mem_str) = exec_cmd(&session, "free -m 2>/dev/null | awk '/Mem:/{print $2,$3}'") {
        let parts: Vec<&str> = mem_str.trim().split_whitespace().collect();
        if parts.len() >= 2 {
            result.memory_total_mb = parts[0].parse().ok();
            result.memory_used_mb = parts[1].parse().ok();
        }
    }

    // Disk info (root partition, in GB)
    if let Ok(disk_str) = exec_cmd(&session, "df -BG / 2>/dev/null | awk 'NR==2{gsub(/G/,\"\",$2); gsub(/G/,\"\",$3); print $2,$3}'") {
        let parts: Vec<&str> = disk_str.trim().split_whitespace().collect();
        if parts.len() >= 2 {
            result.disk_total_gb = parts[0].parse().ok();
            result.disk_used_gb = parts[1].parse().ok();
        }
    }

    // IP addresses
    if let Ok(ip_str) = exec_cmd(&session, "hostname -I 2>/dev/null || ifconfig 2>/dev/null | grep 'inet ' | awk '{print $2}'") {
        result.ip_addresses = ip_str.trim().split_whitespace().map(|s| s.to_string()).filter(|s| !s.is_empty()).collect();
    }

    result
}

/// Execute a command on remote device via SSH
pub async fn ssh_execute(params: &SshConnParams, command: &str) -> Result<CommandResult, String> {
    let host = params.host.clone();
    let port = params.port;
    let username = params.username.clone();
    let password = params.password.clone();
    let private_key = params.private_key.clone();
    let passphrase = params.passphrase.clone();
    let timeout = params.timeout_secs;
    let cmd = command.to_string();

    tokio::task::spawn_blocking(move || {
        ssh_execute_sync(&host, port, &username, password.as_deref(), private_key.as_deref(), passphrase.as_deref(), timeout, &cmd)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

fn ssh_execute_sync(
    host: &str,
    port: u16,
    username: &str,
    password: Option<&str>,
    private_key: Option<&str>,
    passphrase: Option<&str>,
    timeout_secs: u64,
    command: &str,
) -> Result<CommandResult, String> {
    let start = std::time::Instant::now();
    let addr = format!("{}:{}", host, port);

    let tcp = TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("Invalid address: {}", e))?,
        Duration::from_secs(timeout_secs),
    ).map_err(|e| format!("TCP failed: {}", e))?;

    tcp.set_read_timeout(Some(Duration::from_secs(timeout_secs))).ok();

    let mut session = Session::new().map_err(|e| format!("Session init: {}", e))?;
    session.set_tcp_stream(tcp);
    session.set_timeout((timeout_secs * 1000) as u32);
    session.handshake().map_err(|e| format!("Handshake: {}", e))?;

    // Auth
    let auth_ok = if let Some(key_data) = private_key {
        if Path::new(key_data).exists() {
            session.userauth_pubkey_file(username, None, Path::new(key_data), passphrase).is_ok()
        } else {
            session.userauth_pubkey_memory(username, None, key_data, passphrase).is_ok()
        }
    } else if let Some(pwd) = password {
        session.userauth_password(username, pwd).is_ok()
    } else {
        session.userauth_agent(username).is_ok()
    };

    if !auth_ok || !session.authenticated() {
        return Err("Authentication failed".into());
    }

    // Execute
    let mut channel = session.channel_session().map_err(|e| format!("Channel: {}", e))?;
    channel.exec(command).map_err(|e| format!("Exec: {}", e))?;

    let mut stdout = String::new();
    channel.read_to_string(&mut stdout).ok();

    let mut stderr = String::new();
    channel.stderr().read_to_string(&mut stderr).ok();

    channel.wait_close().ok();
    let exit_code = channel.exit_status().unwrap_or(-1);

    Ok(CommandResult {
        exit_code,
        stdout,
        stderr,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Execute a single command over an existing SSH session (internal helper)
fn exec_cmd(session: &Session, cmd: &str) -> Result<String, String> {
    let mut channel = session.channel_session().map_err(|e| format!("{}", e))?;
    channel.exec(cmd).map_err(|e| format!("{}", e))?;
    let mut output = String::new();
    channel.read_to_string(&mut output).ok();
    channel.wait_close().ok();
    Ok(output)
}

/// Scan a single port on a host (TCP connect)
pub async fn scan_port(host: &str, port: u16, timeout_ms: u64) -> bool {
    let addr = format!("{}:{}", host, port);
    tokio::time::timeout(
        Duration::from_millis(timeout_ms),
        tokio::net::TcpStream::connect(&addr),
    )
    .await
    .map(|r| r.is_ok())
    .unwrap_or(false)
}

/// Scan common ports on a host
pub async fn scan_common_ports(host: &str, timeout_ms: u64) -> Vec<u16> {
    let common_ports: Vec<u16> = vec![
        22, 80, 443, 21, 23, 25, 53, 110, 143, 993, 995,
        3306, 5432, 6379, 8080, 8443, 3389, 5900, 161, 162,
        445, 139, 135, 1433, 1521, 27017, 9200, 5601, 8888,
    ];

    let mut handles = vec![];
    for port in &common_ports {
        let h = host.to_string();
        let p = *port;
        let t = timeout_ms;
        handles.push(tokio::spawn(async move {
            if scan_port(&h, p, t).await { Some(p) } else { None }
        }));
    }

    let mut open_ports = vec![];
    for handle in handles {
        if let Ok(Some(port)) = handle.await {
            open_ports.push(port);
        }
    }

    open_ports.sort();
    open_ports
}

/// Password encryption using AES-256-GCM
pub mod crypto {
    use aes_gcm::{
        aead::{Aead, KeyInit},
        Aes256Gcm, Nonce,
    };
    use base64::{Engine as _, engine::general_purpose::STANDARD as B64};
    use rand::RngCore;

    /// Derive a 32-byte key from the app secret
    fn derive_key(secret: &str) -> [u8; 32] {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(secret.as_bytes());
        hasher.update(b"cybersec-pro-agent-key-v1");
        let result = hasher.finalize();
        let mut key = [0u8; 32];
        key.copy_from_slice(&result);
        key
    }

    /// Encrypt a password
    pub fn encrypt_password(plaintext: &str, secret: &str) -> Result<String, String> {
        let key = derive_key(secret);
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Cipher init: {}", e))?;

        let mut nonce_bytes = [0u8; 12];
        rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| format!("Encrypt failed: {}", e))?;

        // Format: base64(nonce + ciphertext)
        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);

        Ok(B64.encode(&combined))
    }

    /// Decrypt a password
    pub fn decrypt_password(encrypted: &str, secret: &str) -> Result<String, String> {
        let key = derive_key(secret);
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Cipher init: {}", e))?;

        let combined = B64.decode(encrypted).map_err(|e| format!("Base64 decode: {}", e))?;
        if combined.len() < 13 {
            return Err("Invalid encrypted data".into());
        }

        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = cipher.decrypt(nonce, ciphertext)
            .map_err(|_| "Decrypt failed — wrong key or corrupted data".to_string())?;

        String::from_utf8(plaintext).map_err(|e| format!("UTF-8 decode: {}", e))
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_encrypt_decrypt_roundtrip() {
            let plaintext = "my_secret_password_123";
            let secret = "app_secret_key";

            let encrypted = encrypt_password(plaintext, secret).expect("Encryption failed");
            assert!(!encrypted.is_empty(), "Encrypted password should not be empty");
            assert_ne!(encrypted, plaintext, "Encrypted text should differ from plaintext");

            let decrypted = decrypt_password(&encrypted, secret).expect("Decryption failed");
            assert_eq!(decrypted, plaintext, "Decrypted text should match original plaintext");
        }

        #[test]
        fn test_encrypt_decrypt_with_special_chars() {
            let plaintext = "p@$$w0rd!#%&*()_+-=[]{}|:;<>,.?/~`";
            let secret = "test_secret";

            let encrypted = encrypt_password(plaintext, secret).expect("Encryption failed");
            let decrypted = decrypt_password(&encrypted, secret).expect("Decryption failed");
            assert_eq!(decrypted, plaintext);
        }

        #[test]
        fn test_encrypt_decrypt_empty_password() {
            let plaintext = "";
            let secret = "secret";

            let encrypted = encrypt_password(plaintext, secret).expect("Encryption failed");
            let decrypted = decrypt_password(&encrypted, secret).expect("Decryption failed");
            assert_eq!(decrypted, plaintext);
        }

        #[test]
        fn test_encrypt_same_plaintext_different_ciphertext() {
            let plaintext = "password";
            let secret = "secret";

            let encrypted1 = encrypt_password(plaintext, secret).expect("Encryption 1 failed");
            let encrypted2 = encrypt_password(plaintext, secret).expect("Encryption 2 failed");

            // Due to random nonce, ciphertexts should differ
            assert_ne!(encrypted1, encrypted2, "Same plaintext with random nonce should produce different ciphertexts");

            // But both should decrypt to same value
            let dec1 = decrypt_password(&encrypted1, secret).expect("Decrypt 1 failed");
            let dec2 = decrypt_password(&encrypted2, secret).expect("Decrypt 2 failed");
            assert_eq!(dec1, plaintext);
            assert_eq!(dec2, plaintext);
        }

        #[test]
        fn test_decrypt_with_wrong_secret() {
            let plaintext = "original_password";
            let secret = "correct_secret";
            let wrong_secret = "wrong_secret";

            let encrypted = encrypt_password(plaintext, secret).expect("Encryption failed");
            let result = decrypt_password(&encrypted, wrong_secret);
            assert!(result.is_err(), "Decryption with wrong secret should fail");
        }

        #[test]
        fn test_decrypt_invalid_base64() {
            let result = decrypt_password("not_valid_base64!!!", "secret");
            assert!(result.is_err(), "Decryption of invalid base64 should fail");
        }

        #[test]
        fn test_decrypt_truncated_data() {
            let result = decrypt_password("YWJjZA==", "secret");  // base64("abcd") = 4 bytes < 13 required
            assert!(result.is_err(), "Decryption of truncated data should fail");
        }

        #[test]
        fn test_encrypt_long_password() {
            let plaintext = "x".repeat(1000);  // Very long password
            let secret = "secret";

            let encrypted = encrypt_password(&plaintext, secret).expect("Encryption failed");
            let decrypted = decrypt_password(&encrypted, secret).expect("Decryption failed");
            assert_eq!(decrypted, plaintext);
        }

        #[test]
        fn test_different_secrets_different_keys() {
            let plaintext = "password";
            let secret1 = "secret1";
            let secret2 = "secret2";

            let encrypted1 = encrypt_password(plaintext, secret1).expect("Encryption 1 failed");
            let encrypted2 = encrypt_password(plaintext, secret2).expect("Encryption 2 failed");

            // Encrypted values should be different due to different keys
            assert_ne!(encrypted1, encrypted2);

            // secret1 key should decrypt encrypted1 but not encrypted2
            let dec1 = decrypt_password(&encrypted1, secret1).expect("Decrypt 1 failed");
            assert_eq!(dec1, plaintext);

            let result = decrypt_password(&encrypted2, secret1);
            assert!(result.is_err(), "Wrong key should fail decryption");
        }
    }
}
