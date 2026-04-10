//! # Network Discovery Engine — CyberSec Pro
//!
//! Scans subnets to discover hosts, open ports, and services.
//! Uses async TCP scanning with configurable concurrency.

use std::net::Ipv4Addr;
use std::time::Duration;
use ipnet::Ipv4Net;
use tokio::sync::Semaphore;
use std::sync::Arc;
use tracing::{info, debug};

/// A discovered host on the network
#[derive(Debug, Clone, serde::Serialize)]
pub struct DiscoveredHost {
    pub ip: String,
    pub hostname: Option<String>,
    pub open_ports: Vec<PortInfo>,
    pub os_guess: Option<String>,
    pub device_type: String,   // server, workstation, router, printer, iot, unknown
    pub is_reachable: bool,
    pub latency_ms: f64,
}

/// Port scan result
#[derive(Debug, Clone, serde::Serialize)]
pub struct PortInfo {
    pub port: u16,
    pub service: String,
    pub state: String,  // open, filtered
}

/// Discovery options
pub struct DiscoveryOptions {
    pub subnet: String,           // e.g. "10.0.0.0/24"
    pub port_scan: bool,
    pub ports: Vec<u16>,
    pub timeout_ms: u64,
    pub max_concurrent: usize,
}

impl Default for DiscoveryOptions {
    fn default() -> Self {
        Self {
            subnet: "10.0.0.0/24".into(),
            port_scan: true,
            ports: vec![22, 80, 443, 3389, 8080, 21, 23, 25, 53, 161, 445, 3306, 5432, 8443],
            timeout_ms: 1500,
            max_concurrent: 100,
        }
    }
}

/// Service name from port number
fn service_name(port: u16) -> &'static str {
    match port {
        21 => "FTP",
        22 => "SSH",
        23 => "Telnet",
        25 => "SMTP",
        53 => "DNS",
        80 => "HTTP",
        110 => "POP3",
        143 => "IMAP",
        161 => "SNMP",
        443 => "HTTPS",
        445 => "SMB",
        993 => "IMAPS",
        995 => "POP3S",
        1433 => "MSSQL",
        1521 => "Oracle",
        3306 => "MySQL",
        3389 => "RDP",
        5432 => "PostgreSQL",
        5900 => "VNC",
        6379 => "Redis",
        8080 => "HTTP-Alt",
        8443 => "HTTPS-Alt",
        9200 => "Elasticsearch",
        27017 => "MongoDB",
        _ => "Unknown",
    }
}

/// Guess device type from open ports
fn guess_device_type(ports: &[u16]) -> String {
    if ports.contains(&3389) || ports.contains(&445) {
        "windows".into()
    } else if ports.contains(&22) && (ports.contains(&80) || ports.contains(&443)) {
        "server".into()
    } else if ports.contains(&22) {
        "linux".into()
    } else if ports.contains(&23) || ports.contains(&161) {
        "network_device".into()
    } else if ports.contains(&80) || ports.contains(&443) {
        "web_device".into()
    } else if ports.contains(&631) || ports.contains(&9100) {
        "printer".into()
    } else if ports.is_empty() {
        "unknown".into()
    } else {
        "device".into()
    }
}

/// Guess OS from open ports
fn guess_os(ports: &[u16]) -> Option<String> {
    if ports.contains(&3389) || ports.contains(&445) || ports.contains(&135) {
        Some("Windows".into())
    } else if ports.contains(&22) {
        Some("Linux/Unix".into())
    } else if ports.contains(&5900) {
        Some("macOS/VNC".into())
    } else if ports.contains(&23) && ports.contains(&161) {
        Some("Network Device (Router/Switch)".into())
    } else {
        None
    }
}

/// Discover hosts on a subnet
pub async fn discover_subnet(options: &DiscoveryOptions) -> Result<Vec<DiscoveredHost>, String> {
    let subnet: Ipv4Net = options.subnet.parse()
        .map_err(|e| format!("Invalid subnet '{}': {}", options.subnet, e))?;

    let hosts: Vec<Ipv4Addr> = subnet.hosts().collect();
    let total = hosts.len();
    info!("🔍 Starting network discovery: {} ({} hosts)", options.subnet, total);

    let semaphore = Arc::new(Semaphore::new(options.max_concurrent));
    let mut handles = vec![];

    for ip in hosts {
        let sem = semaphore.clone();
        let ports = options.ports.clone();
        let timeout_ms = options.timeout_ms;
        let do_port_scan = options.port_scan;

        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;
            let ip_str = ip.to_string();

            // Quick reachability check (common ports)
            let check_ports = vec![22, 80, 443, 3389, 23, 161];
            let mut is_alive = false;
            let start = std::time::Instant::now();

            for p in &check_ports {
                let addr = format!("{}:{}", ip_str, p);
                if tokio::time::timeout(
                    Duration::from_millis(timeout_ms),
                    tokio::net::TcpStream::connect(&addr),
                ).await.map(|r| r.is_ok()).unwrap_or(false) {
                    is_alive = true;
                    break;
                }
            }

            if !is_alive {
                return None;
            }

            let latency = start.elapsed().as_secs_f64() * 1000.0;

            // Full port scan if requested
            let mut open_ports_info = vec![];
            if do_port_scan {
                for port in &ports {
                    let addr = format!("{}:{}", ip_str, port);
                    if tokio::time::timeout(
                        Duration::from_millis(timeout_ms),
                        tokio::net::TcpStream::connect(&addr),
                    ).await.map(|r| r.is_ok()).unwrap_or(false) {
                        open_ports_info.push(PortInfo {
                            port: *port,
                            service: service_name(*port).into(),
                            state: "open".into(),
                        });
                    }
                }
            }

            let open_port_nums: Vec<u16> = open_ports_info.iter().map(|p| p.port).collect();
            let device_type = guess_device_type(&open_port_nums);
            let os_guess = guess_os(&open_port_nums);

            // Try reverse DNS
            let hostname = tokio::task::spawn_blocking({
                let ip_str = ip_str.clone();
                move || {
                    use std::net::ToSocketAddrs;
                    format!("{}:0", ip_str).to_socket_addrs()
                        .ok()
                        .and_then(|mut addrs| addrs.next())
                        .and_then(|_| {
                            // Simple reverse lookup attempt
                            None::<String>
                        })
                }
            }).await.unwrap_or(None);

            Some(DiscoveredHost {
                ip: ip_str,
                hostname,
                open_ports: open_ports_info,
                os_guess,
                device_type,
                is_reachable: true,
                latency_ms: latency,
            })
        }));
    }

    let mut discovered = vec![];
    for handle in handles {
        if let Ok(Some(host)) = handle.await {
            discovered.push(host);
        }
    }

    discovered.sort_by(|a, b| {
        let a_ip: Ipv4Addr = a.ip.parse().unwrap_or(Ipv4Addr::UNSPECIFIED);
        let b_ip: Ipv4Addr = b.ip.parse().unwrap_or(Ipv4Addr::UNSPECIFIED);
        a_ip.cmp(&b_ip)
    });

    info!("✅ Discovery complete: {} hosts found on {}", discovered.len(), options.subnet);
    Ok(discovered)
}
