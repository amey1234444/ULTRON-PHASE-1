# DEPLOYMENT.md
## ULTRON — Deployment Guide

**Purpose:** Step-by-step instructions for deploying ULTRON on Windows (desktop app) and Linux/Raspberry Pi (backend).
**Last Updated:** 2026-06-02
**Audience:** Deployment engineers, plant technicians, DevOps

> Cross-references: [HARDWARE.md](HARDWARE.md) | [SECURITY.md](SECURITY.md) | [TESTING.md](TESTING.md)

---

## Deployment Overview

ULTRON has two components to deploy:

| Component | Target | Language |
|-----------|--------|---------|
| **ULTRON Backend** | Raspberry Pi 4 (Linux) | Python / FastAPI |
| **ULTRON Desktop** | Operator's Windows PC | Tauri / React |

In development, both can run on the same Windows machine in simulation mode.

---

## 1. Development Deployment (Windows, Simulation Mode)

### Prerequisites

- Python 3.11+
- Node.js 20+
- Rust toolchain (for Tauri build only)
- Git

### Step 1 — Backend

```powershell
cd "e:\Oswar Software\ULTRON\ULTRON PHASE 1 DEMO\ultron-backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# .env should have SIMULATED=true (default)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend runs at: `http://localhost:8000`

### Step 2 — Desktop App (Dev Mode)

```powershell
cd "e:\Oswar Software\ULTRON\ULTRON PHASE 1 DEMO\ultron-desktop"
npm install
npm run tauri dev
```

Dashboard opens in a native window. Connects to `ws://localhost:8000/ws`.

---

## 2. Production Build — Windows Desktop App

### Prerequisites

- Rust toolchain: `rustup` (https://rustup.rs)
- Node.js 20+
- Tauri CLI: `npm install -g @tauri-apps/cli`

### Build

```powershell
cd "e:\Oswar Software\ULTRON\ULTRON PHASE 1 DEMO\ultron-desktop"
npm install
npm run type-check          # Must show 0 errors
npm run tauri build
```

### Output

```
ultron-desktop\src-tauri\target\release\bundle\
├── nsis\ULTRON_1.0.0_x64-setup.exe    ← NSIS installer
└── msi\ULTRON_1.0.0_x64_en-US.msi    ← MSI package
```

### Install

Run `ULTRON_1.0.0_x64-setup.exe` on the operator's Windows PC.

### Backend Bundling

The Tauri app bundles and auto-starts the Python backend. The `backend_manager.rs` component:
1. Resolves the path to the Python executable and `app.main` inside the Tauri resources directory
2. Spawns the Uvicorn process on startup
3. Kills the process on app close

> **Known issue:** Backend path resolution on production build is not yet verified. Test before shipping. See [HANDOFF.md](HANDOFF.md) for details.

---

## 3. Raspberry Pi Deployment (Linux — Hardware Mode)

### Hardware Requirements

- Raspberry Pi 4 (4 GB or 8 GB)
- MicroSD card (32 GB minimum, Class 10)
- Ethernet connection (recommended) or WiFi
- Power supply: official RPi 4 PSU (5V 3A)
- ADS1115 ADC wired for pressure sensor
- DS18B20 temperature sensor on GPIO 27

### OS

Raspberry Pi OS Lite (64-bit, Bookworm) — headless, no desktop environment needed.

### Step 1 — OS Setup

```bash
# Flash OS via Raspberry Pi Imager
# Set hostname: ultron-edge
# Enable SSH
# Set username: pi, password: <secure password>
# Configure WiFi (if not using Ethernet)
```

### Step 2 — Enable Hardware Interfaces

```bash
# SSH into Raspberry Pi
ssh pi@ultron-edge.local

# Enable I2C and 1-Wire
sudo raspi-config
# → Interface Options → I2C → Enable
# → Interface Options → 1-Wire → Enable

# Or manually:
echo "dtoverlay=w1-gpio" | sudo tee -a /boot/firmware/config.txt
echo "dtparam=i2c_arm=on" | sudo tee -a /boot/firmware/config.txt
sudo reboot
```

### Step 3 — Verify Hardware Interfaces

```bash
# Verify I2C (ADS1115 should appear at 0x48)
i2cdetect -y 1
# Expected output shows 48 in the grid

# Verify 1-Wire (DS18B20)
ls /sys/bus/w1/devices/
# Expected: 28-XXXXXXXXXXXX  (where X is the sensor serial number)
```

### Step 4 — Install Python Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git

# Clone or copy project
git clone <repo-url> /home/pi/ultron
# OR: scp the project from your development machine

cd /home/pi/ultron/ultron-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Step 5 — Configure Environment

```bash
# Create/edit .env
nano /home/pi/ultron/ultron-backend/.env
```

```ini
SIMULATED=false                    # IMPORTANT: use real hardware
HOST=0.0.0.0
PORT=8000
BROADCAST_INTERVAL_MS=100
PRESSURE_GPIO_PIN=17
TEMPERATURE_GPIO_PIN=27
MODBUS_TCP_ENABLED=true
MODBUS_TCP_PORT=5020               # Use 502 in production (see below)
MODBUS_RTU_ENABLED=false
MDNS_ENABLED=true
MDNS_HOSTNAME=ultron-edge
DEVICE_ID=RPi4-RAV-001
DEVICE_NAME=ULTRON Edge RAV-01
```

### Step 6 — Test Before Service Install

```bash
source .venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# Verify in browser: http://ultron-edge.local:8000/health
# Should return {"status": "ok", "mode": "hardware", ...}
```

### Step 7 — Install as systemd Service

```bash
sudo nano /etc/systemd/system/ultron.service
```

```ini
[Unit]
Description=ULTRON Industrial IoT Backend
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi/ultron/ultron-backend
ExecStart=/home/pi/ultron/ultron-backend/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ultron

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable ultron
sudo systemctl start ultron
sudo systemctl status ultron
```

### Step 8 — Verify Service

```bash
# Check status
sudo systemctl status ultron

# View logs
sudo journalctl -u ultron -f

# Check API
curl http://localhost:8000/health
```

### Production Port (Port 502)

Modbus standard port is 502. Port numbers below 1024 require root on Linux.

**Option A (Recommended): Port forwarding with iptables**
```bash
sudo iptables -t nat -A PREROUTING -p tcp --dport 502 -j REDIRECT --to-port 5020
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

**Option B: Set capability (allows non-root to use port 502)**
```bash
sudo setcap 'cap_net_bind_service=+ep' /home/pi/ultron/ultron-backend/.venv/bin/python
# Then set MODBUS_TCP_PORT=502 in .env
```

---

## 4. Configuration Files

### Backend `.env` Reference

All settings with their defaults:

```ini
# Application
APP_NAME=ULTRON
APP_VERSION=1.0.0
DEVICE_ID=RPi4-ULTRON-001
DEVICE_NAME=ULTRON Edge

# Server
HOST=0.0.0.0
PORT=8000
BROADCAST_INTERVAL_MS=100
SIMULATED=true               # Set to false on real hardware

# Sensors
PRESSURE_SENSOR_NAME=PSN-001
TEMPERATURE_SENSOR_NAME=TSN-001
PRESSURE_GPIO_PIN=17
TEMPERATURE_GPIO_PIN=27
PRESSURE_MIN=1.0             # Software floor (bar)
PRESSURE_MAX=15.0            # Software ceiling (bar)
TEMPERATURE_MIN=20.0         # Software floor (°C)
TEMPERATURE_MAX=120.0        # Software ceiling (°C)

# Modbus
MODBUS_TCP_ENABLED=true
MODBUS_TCP_HOST=0.0.0.0
MODBUS_TCP_PORT=5020
MODBUS_RTU_ENABLED=false
MODBUS_RTU_PORT=/dev/ttyUSB0
MODBUS_RTU_BAUDRATE=9600
MODBUS_RTU_PARITY=N
MODBUS_RTU_STOPBITS=1
MODBUS_RTU_BYTESIZE=8
MODBUS_RTU_SLAVE_ID=1
MODBUS_BYTE_ORDER=ABCD
MODBUS_COMPAT_REGISTERS=true

# Discovery
MDNS_ENABLED=true
MDNS_HOSTNAME=ultron-edge
MDNS_SERVICE_TYPE=_ultron._tcp.local.

# Logging
LOG_LEVEL=INFO
LOG_DIR=logs
LOG_MAX_BYTES=5242880        # 5 MB
LOG_BACKUP_COUNT=7
```

---

## 5. Upgrade Process

### Upgrading Backend (Raspberry Pi)

```bash
ssh pi@ultron-edge.local

# Stop service
sudo systemctl stop ultron

# Pull latest code (if using git)
cd /home/pi/ultron
git pull

# Update dependencies
cd ultron-backend
source .venv/bin/activate
pip install -r requirements.txt --upgrade

# Restart service
sudo systemctl start ultron
sudo systemctl status ultron

# Verify
curl http://localhost:8000/health
```

### Upgrading Desktop App (Windows)

1. Build new installer: `npm run tauri build`
2. Run new `ULTRON_X.X.X_x64-setup.exe` on operator PC
3. NSIS installer handles uninstall of previous version automatically

---

## 6. Rollback Process

### Backend Rollback (Git)

```bash
sudo systemctl stop ultron
cd /home/pi/ultron
git log --oneline -5               # Find previous commit
git checkout <previous-commit-hash>
sudo systemctl start ultron
```

### Desktop App Rollback

Keep the previous installer (`.exe` file). Run it to reinstall.

---

## 7. Monitoring and Logs

### Log Location (Raspberry Pi)

- Application logs: `ultron-backend/logs/ultron.log` (rotating, 5 MB × 7 files)
- systemd logs: `sudo journalctl -u ultron -f`

### Key Log Messages

```
INFO  ULTRON v1.0.0 — starting up
INFO  Mode     : HARDWARE
INFO  Interval : 100 ms
INFO  Modbus TCP : ENABLED (port 8000)
INFO  mDNS       : ENABLED (ultron-edge.local → port 8000)
INFO  SensorManager ready | pressure=PSN-001 | temperature=TSN-001
INFO  Sensor loop started (interval=100 ms)
```

Error indicators:
```
ERROR RPi.GPIO not available — cannot initialise hardware pressure sensor
ERROR No DS18B20 1-Wire device found under /sys/bus/w1/devices/
ERROR Sensor loop error: ...
```

### Health Check Script

```bash
#!/bin/bash
# /home/pi/check_ultron.sh
STATUS=$(curl -s http://localhost:8000/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])")
if [ "$STATUS" != "ok" ]; then
  echo "ULTRON unhealthy — restarting"
  sudo systemctl restart ultron
fi
```

Add to cron: `*/5 * * * * /home/pi/check_ultron.sh`

---

## 8. Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Backend won't start | Port 8000 already in use | `sudo fuser -k 8000/tcp` |
| Backend won't start | Python venv missing | `python3 -m venv .venv && pip install -r requirements.txt` |
| `NotImplementedError` on startup | `SIMULATED=false` but no hardware | Set `SIMULATED=true` or implement hardware driver |
| DS18B20 not found | 1-Wire not enabled | Add `dtoverlay=w1-gpio` to `/boot/firmware/config.txt` and reboot |
| ADS1115 not found at 0x48 | I2C not enabled, or wrong wiring | Enable I2C in `raspi-config`, check SDA/SCL connections |
| Modbus TCP no connection | Port 5020 blocked by firewall | `sudo ufw allow 5020/tcp` |
| mDNS not working | Avahi not installed / firewall | `sudo apt install avahi-daemon` |
| Desktop can't find device | mDNS blocked, different subnet | Use manual IP in ManualConnect screen |
| WebSocket keeps disconnecting | Network instability | Check Ethernet cable / WiFi signal |
| Dashboard blank | Backend not running | Start backend, check `/health` |
| Alarm thresholds wrong | `.env` min/max mismatch with frontend constants | Sync `PRESSURE_MAX`/`TEMPERATURE_MAX` in `.env` with `LIMITS` in `constants.ts` |
