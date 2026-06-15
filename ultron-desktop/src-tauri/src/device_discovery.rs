use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::Emitter;
use tokio::task::JoinSet;

/// Identity response from GET /api/device/identity
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceInfo {
    pub device_name:         String,
    pub device_type:         String,
    pub hostname:            String,
    pub machine_id:          Option<String>,
    pub serial_number:       Option<String>,
    pub software_version:    String,
    pub supported_protocols: Vec<String>,
    pub api_port:            u16,
    pub modbus_tcp_port:     u16,
    /// Resolved base URL (not in API response — set by us after probing)
    pub api_base:            String,
}

#[derive(Serialize, Clone)]
struct ProgressPayload {
    phase:   String,
    message: String,
}

impl ProgressPayload {
    fn new(phase: &str, msg: &str) -> Self {
        Self {
            phase:   phase.to_string(),
            message: msg.to_string(),
        }
    }
}

const PROBE_TIMEOUT: Duration = Duration::from_millis(2_000);

/// Probe a single base URL for the ULTRON identity endpoint.
/// Returns None if the URL is unreachable, returns an error code, or the
/// response does not identify as an ULTRON Edge device.
pub async fn probe_url(base_url: &str) -> Option<DeviceInfo> {
    let client = reqwest::Client::builder()
        .timeout(PROBE_TIMEOUT)
        .danger_accept_invalid_certs(true) // local network — TLS not normally used
        .build()
        .ok()?;

    let url  = format!("{}/api/device/identity", base_url);
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }

    let raw: serde_json::Value = resp.json().await.ok()?;
    let device_name = raw["device_name"].as_str()?.to_string();
    if device_name != "ULTRON Edge" {
        return None;
    }

    Some(DeviceInfo {
        device_name,
        device_type:         raw["device_type"].as_str().unwrap_or("raspberry_pi_gateway").to_string(),
        hostname:            raw["hostname"].as_str().unwrap_or("ultron-edge").to_string(),
        machine_id:          raw["machine_id"].as_str().map(str::to_string),
        serial_number:       raw["serial_number"].as_str().map(str::to_string),
        software_version:    raw["software_version"].as_str().unwrap_or("0.1.0").to_string(),
        supported_protocols: raw["supported_protocols"]
            .as_array()
            .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
            .unwrap_or_default(),
        api_port:        raw["api_port"].as_u64().unwrap_or(8000) as u16,
        modbus_tcp_port: raw["modbus_tcp_port"].as_u64().unwrap_or(5020) as u16,
        api_base:        base_url.to_string(),
    })
}

/// Detect the machine's own LAN IP by opening a UDP socket pointed at a
/// well-known external address (no packets are actually sent).
pub fn get_local_ip() -> Option<String> {
    use std::net::UdpSocket;
    let sock = UdpSocket::bind("0.0.0.0:0").ok()?;
    // Connect to a public address just to resolve routing — no packet is sent.
    sock.connect("8.8.8.8:53").ok()?;
    let addr = sock.local_addr().ok()?;
    Some(addr.ip().to_string())
}

/// Extract the /24 subnet prefix (e.g. "192.168.10") from the local IP.
fn local_subnet_prefix() -> Option<String> {
    let ip    = get_local_ip()?;
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 { return None; }
    Some(format!("{}.{}.{}", parts[0], parts[1], parts[2]))
}

/// Full discovery strategy:
///   1. Try last-known IP (fast — returns immediately if still reachable)
///   2. Probe mDNS / well-known hostnames in parallel
///   3. Scan local subnet (detected automatically) + common subnets in batches
///
/// Emits `discovery-progress` Tauri events throughout so the UI can show
/// live progress without blocking.
pub async fn discover_devices(
    last_known_ip: Option<String>,
    app: &tauri::AppHandle,
) -> Vec<DeviceInfo> {
    let emit = |phase: &str, msg: &str| {
        let _ = app.emit("discovery-progress", ProgressPayload::new(phase, msg));
    };

    // ── Step 1: Last-known device ──────────────────────────────────────────────
    if let Some(ip) = last_known_ip {
        emit("cache", "Checking last known device…");
        for port in [8000u16, 8080] {
            let url = format!("http://{}:{}", ip.trim_matches('/'), port);
            if let Some(dev) = probe_url(&url).await {
                emit("found", &format!("Reconnected to {} at {}", dev.device_name, url));
                return vec![dev];
            }
        }
        emit("cache", "Last known device offline — scanning…");
    }

    // ── Step 2: mDNS / well-known hostnames in parallel ───────────────────────
    emit("mdns", "Probing mDNS hostnames (ultron-edge.local)…");
    let hostname_candidates = [
        "http://ultron-edge.local:8000",
        "http://ultron-edge:8000",
        "http://raspberrypi.local:8000",
        "http://raspberrypi:8000",
        "http://localhost:8000",
    ];

    let mut set: JoinSet<Option<DeviceInfo>> = JoinSet::new();
    for url in &hostname_candidates {
        let u = url.to_string();
        set.spawn(async move { probe_url(&u).await });
    }

    let mut found: Vec<DeviceInfo> = Vec::new();
    while let Some(r) = set.join_next().await {
        if let Ok(Some(dev)) = r {
            found.push(dev);
        }
    }
    if !found.is_empty() {
        return deduplicate(found);
    }

    // ── Step 3: Subnet scan ────────────────────────────────────────────────────
    let candidates = generate_subnet_candidates();
    let total = candidates.len();
    emit("subnet", &format!("Scanning {} subnet addresses…", total));

    const BATCH: usize = 30;
    let mut scanned = 0usize;

    for chunk in candidates.chunks(BATCH) {
        let mut set2: JoinSet<Option<DeviceInfo>> = JoinSet::new();
        for url in chunk {
            let u = url.clone();
            set2.spawn(async move { probe_url(&u).await });
        }
        while let Some(r) = set2.join_next().await {
            if let Ok(Some(dev)) = r {
                found.push(dev);
            }
        }
        scanned += chunk.len();
        if !found.is_empty() {
            break; // stop as soon as we find a device
        }
        emit("subnet", &format!("Scanning… {}/{} addresses checked", scanned, total));
    }

    deduplicate(found)
}

/// Build the candidate URL list for subnet scanning.
///
/// Priority order:
///   1. Detected local /24 subnet (e.g. 192.168.10.x when machine is .10.5)
///   2. Common 192.168.x.0/24 subnets covering the ranges seen in industrial LANs
///   3. 10.x.x.x and 172.16.x.x ranges
///
/// Each IP is probed on port 8000 only (8080 kept as a secondary attempt for
/// the last-known-device step, not the subnet scan, to halve probe count).
fn generate_subnet_candidates() -> Vec<String> {
    let mut prefixes: Vec<String> = Vec::new();

    // ── Priority: detected local subnet ───────────────────────────────────────
    if let Some(local) = local_subnet_prefix() {
        prefixes.push(local);
    }

    // ── Common 192.168.x ranges (cover home/office/industrial LANs) ───────────
    // 192.168.0–20 covers the vast majority of consumer + industrial routers.
    for third in [1u8, 0, 10, 2, 3, 4, 5, 11, 12, 20, 50, 100] {
        let p = format!("192.168.{}", third);
        if !prefixes.contains(&p) {
            prefixes.push(p);
        }
    }

    // ── 10.x.x ranges ─────────────────────────────────────────────────────────
    for (b, c) in [(0u8, 0u8), (0, 1), (10, 0), (10, 1), (1, 0), (1, 1)] {
        let p = format!("10.{}.{}", b, c);
        if !prefixes.contains(&p) {
            prefixes.push(p);
        }
    }

    // ── 172.16.x range ────────────────────────────────────────────────────────
    let p = "172.16.0".to_string();
    if !prefixes.contains(&p) { prefixes.push(p); }

    // ── Build URL list: low octets 1–30 + common DHCP band 100–120 ────────────
    let mut urls = Vec::new();
    for prefix in &prefixes {
        for octet in (1u8..=30).chain(100u8..=120) {
            urls.push(format!("http://{}.{}:8000", prefix, octet));
        }
    }
    urls
}

fn deduplicate(devices: Vec<DeviceInfo>) -> Vec<DeviceInfo> {
    let mut seen = std::collections::HashSet::new();
    devices
        .into_iter()
        .filter(|d| seen.insert(d.api_base.clone()))
        .collect()
}
