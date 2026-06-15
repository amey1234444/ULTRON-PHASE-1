use crate::config_store::{self, AppSettings};
use crate::device_discovery::{self, DeviceInfo};
use crate::modbus_discovery::{self, ModbusTarget};
use crate::modbus_reader::{self, ModbusSensorReading};
use crate::AppState;
use tauri::State;

// ── Backend management ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_backend(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<crate::backend_manager::BackendStatus, String> {
    // Resolve backend path relative to the app resource dir or a sibling directory
    let backend_path = resolve_backend_path(&app);

    {
        let mut backend = state.backend.lock().map_err(|_| "Lock poisoned")?;
        if let Some(path) = backend_path {
            backend.set_backend_path(path);
        }
        backend.start()?;
    }

    // Poll until backend is healthy (up to 12 s)
    for _ in 0..24 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        let ok = {
            let backend = state.backend.lock().map_err(|_| "Lock poisoned")?;
            backend.health_check()
        };
        if ok {
            break;
        }
    }

    let mut backend = state.backend.lock().map_err(|_| "Lock poisoned")?;
    Ok(backend.get_status())
}

#[tauri::command]
pub async fn stop_backend(state: State<'_, AppState>) -> Result<(), String> {
    let mut backend = state.backend.lock().map_err(|_| "Lock poisoned")?;
    backend.stop()
}

#[tauri::command]
pub async fn get_backend_status(
    state: State<'_, AppState>,
) -> Result<crate::backend_manager::BackendStatus, String> {
    let mut backend = state.backend.lock().map_err(|_| "Lock poisoned")?;
    Ok(backend.get_status())
}

#[tauri::command]
pub async fn set_backend_port(
    state: State<'_, AppState>,
    port: u16,
) -> Result<(), String> {
    let mut backend = state.backend.lock().map_err(|_| "Lock poisoned")?;
    backend.set_port(port);
    Ok(())
}

// ── Device discovery ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn discover_devices(
    app: tauri::AppHandle,
    last_known_ip: Option<String>,
) -> Result<Vec<DeviceInfo>, String> {
    let devices = device_discovery::discover_devices(last_known_ip, &app).await;
    Ok(devices)
}

#[tauri::command]
pub async fn connect_device(api_base: String) -> Result<DeviceInfo, String> {
    device_discovery::probe_url(&api_base)
        .await
        .ok_or_else(|| {
            format!(
                "No ULTRON device found at {}. Check the IP address and API port.",
                api_base
            )
        })
}

// ── Settings ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_saved_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    config_store::load_settings(&app)
}

#[tauri::command]
pub async fn save_settings(
    app: tauri::AppHandle,
    settings: serde_json::Value,
) -> Result<AppSettings, String> {
    config_store::patch_settings(&app, settings)
}

// ── Simulation mode ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_simulation(state: State<'_, AppState>) -> Result<(), String> {
    let mut sim = state.sim_active.lock().map_err(|_| "Lock poisoned")?;
    *sim = true;
    Ok(())
}

#[tauri::command]
pub async fn stop_simulation(state: State<'_, AppState>) -> Result<(), String> {
    let mut sim = state.sim_active.lock().map_err(|_| "Lock poisoned")?;
    *sim = false;
    Ok(())
}

// ── Modbus discovery ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn scan_modbus_tcp(host: Option<String>) -> Result<Vec<ModbusTarget>, String> {
    if let Some(h) = host {
        Ok(modbus_discovery::scan_modbus_on_host(&h).await)
    } else {
        Ok(modbus_discovery::scan_subnet_modbus().await)
    }
}

// ── Modbus TCP sensor read ────────────────────────────────────────────────────

/// Read pressure + temperature from the Pi's Modbus TCP server (FC4, ABCD byte order).
/// Used as a fallback when the WebSocket connection is unavailable.
#[tauri::command]
pub async fn read_modbus_tcp(
    host:     String,
    port:     u16,
    slave_id: u8,
) -> Result<ModbusSensorReading, String> {
    modbus_reader::read_sensor_registers(&host, port, slave_id).await
}

// ── App info ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Return the machine's primary LAN IP (the IP used for outbound routing).
/// Returns an empty string if it cannot be determined.
#[tauri::command]
pub fn get_local_ip() -> String {
    device_discovery::get_local_ip().unwrap_or_default()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn resolve_backend_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    use tauri::Manager;

    // In production: look for bundled backend next to the executable
    if let Ok(exe) = app.path().executable_dir() {
        let candidates = [
            exe.join("backend"),
            exe.join("ultron-backend"),
            exe.parent().unwrap_or(&exe).join("backend"),
            exe.parent().unwrap_or(&exe).join("ultron-backend"),
        ];
        for path in &candidates {
            if path.join("app").join("main.py").exists() {
                return Some(path.clone());
            }
        }
    }

    // In development: look for sibling directory
    // project root/ultron-desktop/../ultron-backend
    if let Ok(resource_dir) = app.path().resource_dir() {
        // resource_dir is typically src-tauri/.. in dev
        let dev_candidates = [
            resource_dir.join("../ultron-backend"),
            resource_dir.join("../../ultron-backend"),
            resource_dir.join("../../../ultron-backend"),
        ];
        for path in &dev_candidates {
            if let Ok(canonical) = path.canonicalize() {
                if canonical.join("app").join("main.py").exists() {
                    return Some(canonical);
                }
            }
        }
    }

    // Fallback: relative to current directory
    let cwd_candidates = [
        std::path::PathBuf::from("../ultron-backend"),
        std::path::PathBuf::from("../../ultron-backend"),
        std::path::PathBuf::from("ultron-backend"),
    ];
    for path in &cwd_candidates {
        if let Ok(canonical) = path.canonicalize() {
            if canonical.join("app").join("main.py").exists() {
                return Some(canonical);
            }
        }
    }

    None
}
