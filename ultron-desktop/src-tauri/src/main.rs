// Prevent console window from appearing on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend_manager;
mod commands;
mod config_store;
mod device_discovery;
mod modbus_discovery;
mod modbus_reader;

use backend_manager::BackendManager;
use std::sync::Mutex;

/// Shared application state managed by Tauri.
/// Accessible in any command via `State<'_, AppState>`.
pub struct AppState {
    pub backend:    Mutex<BackendManager>,
    pub sim_active: Mutex<bool>,
}

fn main() {
    let state = AppState {
        backend:    Mutex::new(BackendManager::new()),
        sim_active: Mutex::new(false),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::start_backend,
            commands::stop_backend,
            commands::get_backend_status,
            commands::discover_devices,
            commands::connect_device,
            commands::get_saved_settings,
            commands::save_settings,
            commands::start_simulation,
            commands::stop_simulation,
            commands::get_app_version,
            commands::get_local_ip,
            commands::scan_modbus_tcp,
            commands::set_backend_port,
            commands::read_modbus_tcp,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ULTRON");
    // BackendManager::drop() is called automatically when AppState is freed,
    // which kills the backend process cleanly.
}
