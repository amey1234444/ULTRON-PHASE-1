use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub last_device_ip:       Option<String>,
    pub last_device_port:     u16,
    pub last_backend_port:    u16,
    pub last_modbus_tcp_port: u16,
    pub last_rtu_port:        Option<String>,
    pub last_rtu_baudrate:    u32,
    pub last_rtu_slave_id:    u8,
    pub preferred_protocol:   String,
    pub simulation_mode:      bool,
    pub theme:                String,
    pub window_width:         u32,
    pub window_height:        u32,
    pub backend_auto_start:   bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            last_device_ip:       None,
            last_device_port:     8000,
            last_backend_port:    8000,
            last_modbus_tcp_port: 5020,
            last_rtu_port:        None,
            last_rtu_baudrate:    115_200,
            last_rtu_slave_id:    1,
            preferred_protocol:   "lan".to_string(),
            simulation_mode:      false,
            theme:                "dark".to_string(),
            window_width:         1440,
            window_height:        900,
            backend_auto_start:   true,
        }
    }
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create app data dir: {}", e))?;
    Ok(dir.join("settings.json"))
}

pub fn load_settings(app: &tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let data = fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read settings: {}", e))?;
    serde_json::from_str(&data)
        .map_err(|e| format!("Malformed settings file: {} — using defaults", e))
        .or_else(|_| Ok(AppSettings::default()))
}

pub fn save_settings(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    let data = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Cannot serialise settings: {}", e))?;
    fs::write(&path, data).map_err(|e| format!("Cannot write settings: {}", e))
}

pub fn patch_settings(
    app: &tauri::AppHandle,
    patch: serde_json::Value,
) -> Result<AppSettings, String> {
    let mut current = load_settings(app)?;
    let mut current_val = serde_json::to_value(&current)
        .map_err(|e| format!("Serialise error: {}", e))?;

    // Merge patch fields into current
    if let (serde_json::Value::Object(base), serde_json::Value::Object(updates)) =
        (&mut current_val, patch)
    {
        for (k, v) in updates {
            base.insert(k, v);
        }
    }

    current = serde_json::from_value(current_val)
        .map_err(|e| format!("Deserialise error: {}", e))?;
    save_settings(app, &current)?;
    Ok(current)
}
