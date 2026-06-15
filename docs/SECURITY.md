# SECURITY.md
## ULTRON — Security Requirements and Threat Model

**Purpose:** Document security requirements, current vulnerabilities, and the roadmap to secure production deployment.
**Last Updated:** 2026-06-02
**Audience:** Software engineers, DevOps, security reviewers

> Cross-references: [DEPLOYMENT.md](DEPLOYMENT.md) | [API.md](API.md) | [PROTOCOLS.md](PROTOCOLS.md)

---

## Security Posture Summary

| Area | Current Status | Risk | Fix Required |
|------|---------------|------|-------------|
| Authentication | None | High (production) | Phase 3 |
| CORS | `allow_origins=["*"]` | Medium | Before production |
| Transport encryption | HTTP / WS (plaintext) | Medium (local LAN) | Phase 3 |
| Modbus TCP auth | None (Modbus has no auth) | Low (local only) | Architecture decision |
| Local data storage | None (no DB yet) | Low | Phase 2 |
| Credential handling | No credentials in code | ✅ OK | — |
| `.env` secrets | No sensitive secrets in Phase 1 | ✅ OK | Monitor as features grow |
| Network exposure | Local LAN only | ✅ OK for Phase 1 | Firewall in production |

**Phase 1 is safe for trusted local network deployment only.** Do not expose ULTRON to the public internet without the fixes documented below.

---

## 1. Current Security Architecture

### Network Exposure

In Phase 1, ULTRON exposes:

| Port | Protocol | Exposed To | Purpose |
|------|---------|-----------|---------|
| 8000 | HTTP / WebSocket | Local LAN | FastAPI + WebSocket |
| 5020 | Modbus TCP | Local LAN | PLC/SCADA integration |
| 5353 (UDP) | mDNS | Local LAN | Device discovery |

**None of these ports should be exposed to the internet in Phase 1.**

### Authentication

**Phase 1: No authentication.**

All REST endpoints and the WebSocket connection are open to anyone on the local network. This is acceptable for:
- Trusted factory/plant LAN with no internet access
- Demo environments
- Development machines

This is **not acceptable** for:
- Any internet-facing deployment
- Multi-user environments with different permission levels
- Cloud deployment

### Modbus TCP Security

Modbus TCP has no built-in authentication or encryption. This is a fundamental limitation of the Modbus protocol.

**Mitigation:**
- Restrict Modbus TCP port (5020/502) to specific IP addresses using firewall rules
- Do not expose Modbus TCP port beyond the control network (factory LAN)
- Future: VPN for remote Modbus access

---

## 2. Known Vulnerabilities and Fixes

### VULN-001 — CORS Wildcard (`allow_origins=["*"]`)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **File** | `ultron-backend/app/main.py:156` |
| **Risk** | A malicious website could make requests to the backend API if the browser is on the same network as the Raspberry Pi |
| **Fix** | Restrict to Tauri app origin |

**Fix:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost",          # Tauri production
        "http://localhost:5173",      # Vite dev server
        "http://localhost:8000",      # Local dev
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)
```

**Priority:** Fix before production deployment.

---

### VULN-002 — No Authentication on Any Endpoint

| Field | Detail |
|-------|--------|
| **Severity** | High (for internet-facing), Low (for local LAN) |
| **Scope** | All REST endpoints + WebSocket |
| **Risk** | Anyone on the LAN can read sensor data and device information |
| **Fix** | Add JWT bearer token or API key authentication |

**Planned Fix (Phase 3):**

```python
# API key authentication example
from fastapi.security.api_key import APIKeyHeader
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME)

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != settings.api_key:
        raise HTTPException(status_code=403, detail="Invalid API key")
```

**Note:** Modbus TCP cannot be authenticated (protocol limitation). Network-level access control (firewall) is the mitigation for Modbus.

---

### VULN-003 — Plaintext HTTP/WebSocket

| Field | Detail |
|-------|--------|
| **Severity** | Low (local LAN), High (internet/cloud) |
| **Risk** | Data transmitted in plaintext — interceptable by network sniffers on same LAN |
| **Fix** | TLS (HTTPS / WSS) |

**Planned Fix (Phase 5 cloud deployment):**

```python
# Option A: nginx reverse proxy with TLS certificate
# ultron runs on http://localhost:8000
# nginx terminates TLS, proxies to http://localhost:8000

# Option B: Let's Encrypt with certbot
# uvicorn app.main:app --ssl-certfile=/etc/letsencrypt/live/*/fullchain.pem \
#                       --ssl-keyfile=/etc/letsencrypt/live/*/privkey.pem

# Frontend: change ws:// to wss://, http:// to https://
```

**For Phase 1 local deployment:** Plaintext is acceptable on a trusted factory LAN. The risk is low.

---

### VULN-004 — Device Identity Endpoint Unauthenticated

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Endpoint** | `GET /api/device/identity` |
| **Risk** | Anyone on LAN can probe this endpoint to learn the device is ULTRON and learn its capabilities |
| **Note** | This endpoint is intentionally public for auto-discovery. The code comment documents this design decision. |
| **Fix** | Rate-limit in production if discovery probing is a concern |

---

## 3. Credential Handling

### Current State

ULTRON Phase 1 has **no sensitive credentials**:

- No passwords
- No API keys
- No tokens
- No database credentials
- No cloud credentials

The `.env` file contains only operational configuration (ports, intervals, hostnames).

### Rules (Current and Future)

| Rule | Status |
|------|--------|
| Never commit `.env` to git | ✅ `.env` is in `.gitignore` |
| Never hardcode passwords/keys in source code | ✅ Enforced |
| Use environment variables for all secrets | ✅ Enforced via `config.py` |
| Never log sensitive values | ✅ No sensitive values exist in Phase 1 |
| Rotate credentials on compromise | N/A in Phase 1 |

### When Credentials Are Introduced

Phase 3+ will introduce:
- API keys for ULTRON REST authentication
- Database passwords (Phase 2 SQLite → doesn't need a password; Phase 5 PostgreSQL/cloud does)
- Cloud MQTT credentials (Phase 5)

All credentials must:
1. Be stored in `.env` (never in code)
2. Be excluded from git (`.gitignore`)
3. Never appear in log output
4. Be rotatable without code changes

---

## 4. Local Storage Security

### Tauri App (Desktop)

The ULTRON Desktop stores:
- Last known device IP address
- App preferences (theme, sidebar state)
- WebSocket URL

Stored in: Tauri's app data directory (`AppData/Roaming/ULTRON/` on Windows)

**No sensitive data is stored locally.** The stored data is device configuration only.

### Future: Storing API Keys

When API keys are introduced (Phase 3), they must be stored in the OS credential store:
- Windows: Windows Credential Manager
- Linux: Secret Service API (libsecret)
- Tauri provides: `tauri-plugin-stronghold` for secure credential storage

Do **not** store API keys in localStorage or plain JSON files.

---

## 5. Device Discovery Security

### mDNS Exposure

The ULTRON backend advertises `_ultron._tcp.local.` on the local network. This means:
- Any device on the same LAN can discover the ULTRON Raspberry Pi
- The device IP and port are publicly visible to all LAN devices

**Risk:** Low — acceptable for factory/plant LAN. An attacker on the LAN could discover and connect to ULTRON, but can only read sensor data (no write capability in Phase 1).

**Mitigation for sensitive environments:**
- Disable mDNS: `MDNS_ENABLED=false` in `.env`
- Use manual IP configuration in the desktop app

---

## 6. Modbus Security Considerations

Modbus TCP (and RTU) have no security mechanisms. This is a fundamental limitation of the Modbus protocol, which was designed for isolated factory networks in the 1970s.

### Risks

| Risk | Description |
|------|-------------|
| Unauthorized reads | Any Modbus master on the network can read all ULTRON registers |
| No encryption | Modbus data is always plaintext |
| Replay attacks | Modbus requests can theoretically be replayed |

### Mitigations (Current)

1. **Network isolation:** Keep the industrial control network separate from the corporate/IT network and internet
2. **Firewall:** Restrict Modbus TCP port to specific PLC/SCADA IP addresses using iptables
3. **Read-only:** ULTRON Modbus registers are Input Registers (FC4) — read-only by design. There are no write commands implemented.

### iptables Example

```bash
# Allow only specific PLC IP to access Modbus TCP
sudo iptables -A INPUT -p tcp --dport 5020 -s 192.168.1.50 -j ACCEPT  # PLC IP
sudo iptables -A INPUT -p tcp --dport 5020 -j DROP                     # Drop all others
```

---

## 7. Network Exposure Rules

### Phase 1 (Current)

| Rule | Value |
|------|-------|
| Backend accessible from | Local LAN only |
| Firewall | Not yet configured — assumed to be on isolated factory network |
| Internet exposure | MUST NOT be exposed to internet |
| SSH access | Restricted to local LAN, password or key auth |

### Production Hardening Checklist

Before deploying in a production plant environment:

- [ ] Restrict CORS: change `allow_origins=["*"]` in `main.py`
- [ ] Configure `iptables` to restrict Modbus TCP port to specific IPs
- [ ] Change default SSH password on Raspberry Pi
- [ ] Disable SSH password auth on Raspberry Pi (use SSH keys only)
- [ ] Disable mDNS if not needed (`MDNS_ENABLED=false`)
- [ ] Set static IP for Raspberry Pi
- [ ] Configure watchdog service for automatic restart
- [ ] Enable automatic OS security updates: `sudo apt install unattended-upgrades`

---

## 8. Future Authentication Roadmap

| Phase | Authentication Feature |
|-------|----------------------|
| Phase 3 | API key authentication on REST endpoints |
| Phase 3 | API key for WebSocket connection (query parameter or header) |
| Phase 4 | JWT bearer tokens for multi-user environments |
| Phase 5 | OAuth2 / SSO for cloud dashboard |
| Phase 5 | Role-based access control (read-only vs. admin) |

### JWT Implementation Plan (Phase 3)

```python
# Proposed: simple API key first, JWT later
# .env
API_KEY=<random 32-byte hex string>

# FastAPI security dependency
from fastapi.security import APIKeyHeader
security = APIKeyHeader(name="X-API-Key")

@app.get("/sensors/latest")
async def get_latest(api_key: str = Depends(verify_api_key)):
    ...
```

WebSocket authentication:
```
wss://host:8000/ws?api_key=<key>
# OR
ws.send(JSON.stringify({type: "auth", key: "<api_key>"}))
```

---

## 9. Threat Model

| Threat | Likelihood (Phase 1 LAN) | Impact | Mitigation |
|--------|--------------------------|--------|-----------|
| Unauthorized sensor data read | Low (LAN only) | Low (data is not sensitive) | Authentication (Phase 3) |
| Man-in-the-middle | Very Low (LAN only) | Low | TLS (Phase 5) |
| DoS on backend API | Very Low | Medium (dashboard goes offline) | Rate limiting (future) |
| Physical access to RPi | Low | High (full access) | Physical security, encrypted storage (future) |
| Internet exposure | Low if deployed correctly | Critical | Firewall — never expose to internet |
| Malicious PLC writing to Modbus | N/A | N/A | All Modbus registers are read-only in ULTRON |
| SD card corruption on RPi | Medium | Medium | Watchdog service, startup checks |
