use serde::{Deserialize, Serialize};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModbusTarget {
    pub host: String,
    pub port: u16,
    pub reachable: bool,
}

/// Probe whether a Modbus TCP server is accepting connections at host:port.
/// Does NOT send any Modbus PDU — just checks if TCP handshake succeeds.
pub async fn probe_modbus_tcp(host: &str, port: u16) -> bool {
    timeout(
        Duration::from_millis(600),
        TcpStream::connect((host, port)),
    )
    .await
    .map(|r| r.is_ok())
    .unwrap_or(false)
}

/// Scan common Modbus TCP ports on a given host.
pub async fn scan_modbus_on_host(host: &str) -> Vec<ModbusTarget> {
    let ports = [5020u16, 502];
    let mut results = Vec::new();
    for port in ports {
        let reachable = probe_modbus_tcp(host, port).await;
        results.push(ModbusTarget {
            host: host.to_string(),
            port,
            reachable,
        });
    }
    results
}

/// Scan Modbus TCP ports across common subnet addresses.
/// Returns only reachable targets.
pub async fn scan_subnet_modbus() -> Vec<ModbusTarget> {
    let subnets = [
        "192.168.1", "192.168.0", "10.0.0",
    ];
    let ranges = [1u8, 30];
    let mut tasks = Vec::new();

    for subnet in &subnets {
        for host_octet in ranges[0]..=ranges[1] {
            let host = format!("{}.{}", subnet, host_octet);
            tasks.push(tokio::spawn(async move {
                scan_modbus_on_host(&host).await
            }));
        }
    }

    let mut found = Vec::new();
    for task in tasks {
        if let Ok(results) = task.await {
            for r in results {
                if r.reachable {
                    found.push(r);
                }
            }
        }
    }
    found
}
