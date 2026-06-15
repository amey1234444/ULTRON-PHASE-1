use serde::{Deserialize, Serialize};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackendStatus {
    pub running:    bool,
    pub pid:        Option<u32>,
    pub port:       u16,
    pub external:   bool, // true if not launched by us (already running externally)
    pub health_ok:  bool,
    pub uptime_secs: Option<u64>,
}

pub struct BackendManager {
    process:      Option<Child>,
    port:         u16,
    backend_path: Option<PathBuf>,
    started_at:   Option<Instant>,
}

impl BackendManager {
    pub fn new() -> Self {
        Self {
            process:      None,
            port:         8000,
            backend_path: None,
            started_at:   None,
        }
    }

    pub fn set_backend_path(&mut self, path: PathBuf) {
        self.backend_path = Some(path);
    }

    pub fn set_port(&mut self, port: u16) {
        self.port = port;
    }

    /// TCP probe — returns true if something is listening on our port.
    pub fn health_check(&self) -> bool {
        let addr = format!("127.0.0.1:{}", self.port);
        TcpStream::connect_timeout(
            &addr.parse().unwrap_or_else(|_| "127.0.0.1:8000".parse().unwrap()),
            Duration::from_millis(400),
        )
        .is_ok()
    }

    /// Check if our managed child process is still alive.
    fn managed_running(&mut self) -> bool {
        match &mut self.process {
            None => false,
            Some(child) => match child.try_wait() {
                Ok(Some(_)) => {
                    // Process exited
                    self.process    = None;
                    self.started_at = None;
                    false
                }
                Ok(None) => true,
                Err(_)   => false,
            },
        }
    }

    /// Start the backend.  No-op if already running.
    pub fn start(&mut self) -> Result<(), String> {
        // Someone else (e.g. a previous session) is already serving — don't double-start.
        if self.health_check() {
            return Ok(());
        }
        if self.managed_running() {
            return Ok(());
        }

        let backend_dir = self
            .backend_path
            .clone()
            .ok_or_else(|| "Backend path not configured".to_string())?;

        if !backend_dir.exists() {
            return Err(format!(
                "Backend directory not found: {}",
                backend_dir.display()
            ));
        }

        let python = find_python(&backend_dir)?;
        let port   = self.port.to_string();

        let mut cmd = Command::new(&python);
        cmd.args([
            "-m", "uvicorn",
            "app.main:app",
            "--host", "0.0.0.0",
            "--port", &port,
            "--log-level", "warning",
        ]);
        cmd.current_dir(&backend_dir);
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());

        // Prevent a console window from flashing on Windows
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to launch backend: {}", e))?;

        self.process    = Some(child);
        self.started_at = Some(Instant::now());
        Ok(())
    }

    /// Stop the managed backend process.
    pub fn stop(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.process.take() {
            let _ = child.kill();
            let _ = child.wait();
            self.started_at = None;
        }
        Ok(())
    }

    /// Restart if the process has died unexpectedly.
    pub fn restart_if_crashed(&mut self) -> bool {
        if !self.managed_running() && self.started_at.is_some() {
            self.started_at = None;
            let _ = self.start();
            return true;
        }
        false
    }

    pub fn get_status(&mut self) -> BackendStatus {
        let managed    = self.managed_running();
        let health     = self.health_check();
        let uptime_secs = self.started_at.map(|t| t.elapsed().as_secs());
        BackendStatus {
            running:     managed || health,
            pid:         self.process.as_ref().map(|c| c.id()),
            port:        self.port,
            external:    !managed && health,
            health_ok:   health,
            uptime_secs,
        }
    }
}

impl Drop for BackendManager {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn find_python(backend_dir: &Path) -> Result<String, String> {
    // 1. Prefer the virtual environment created by the user
    #[cfg(target_os = "windows")]
    let venv = backend_dir.join(".venv").join("Scripts").join("python.exe");
    #[cfg(not(target_os = "windows"))]
    let venv = backend_dir.join(".venv").join("bin").join("python3");

    if venv.exists() {
        return Ok(venv.to_string_lossy().into_owned());
    }

    // 2. Also check for conda or other env managers
    #[cfg(target_os = "windows")]
    let venv_alt = backend_dir.join(".venv").join("Scripts").join("python3.exe");
    #[cfg(not(target_os = "windows"))]
    let venv_alt = backend_dir.join(".venv").join("bin").join("python");

    if venv_alt.exists() {
        return Ok(venv_alt.to_string_lossy().into_owned());
    }

    // 3. System Python
    for name in &["python", "python3", "python3.11", "python3.12"] {
        if command_exists(name) {
            return Ok(name.to_string());
        }
    }

    Err(concat!(
        "Python not found. ",
        "Please set up the backend environment: ",
        "cd ultron-backend && python -m venv .venv && ",
        "pip install -r requirements.txt"
    )
    .to_string())
}

fn command_exists(name: &str) -> bool {
    Command::new(name)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}
