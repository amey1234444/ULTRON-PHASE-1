"""
ULTRON Colab/Cloud Bridge — push live data to the ULTRON backend from anywhere.

Run this from Google Colab, a cloud VM, or any machine with internet access.
It PUSHES sensor readings to the backend's /api/bridges/ingest endpoint, so it
works even when this machine is behind NAT / has no public IP (Colab included).

────────────────────────────────────────────────────────────────────────────
HOW ROUTING WORKS (read this once)
────────────────────────────────────────────────────────────────────────────
On the dashboard, open a Machine card → the 🔗 "Bridge binding" button, and set
a Machine ID + IP + Port for the device you want this data to appear on.

The backend routes a reading to that device only when BOTH the MACHINE_ID and the
IP reported below match the binding EXACTLY. The IP is just a label you choose —
it does NOT have to be Colab's real address (Colab has none that the backend can
see). Pick any value, put the SAME value in the binding form and in `IP` below.

Example binding on the dashboard:   Machine ID = RAV-01,  IP = 10.0.0.5,  Port = 8765
Then set below:                     MACHINE_ID = "RAV-01", IP = "10.0.0.5", PORT = 8765

────────────────────────────────────────────────────────────────────────────
USAGE
────────────────────────────────────────────────────────────────────────────
In Google Colab — paste this whole file into a cell, edit the CONFIG block, run.
  (Colab already has `requests` installed; nothing to pip install.)

As a script:
  python ultron_colab_bridge.py \
      --backend https://ultron-backend-pakd.onrender.com \
      --machine-id RAV-01 --ip 10.0.0.5 --port 8765 --interval 1.0
"""

import argparse
import math
import random
import sys
import time
from datetime import datetime, timezone

import requests  # pre-installed in Colab; otherwise: pip install requests

# ════════════════════════════════════════════════════════════════════════════
# CONFIG — edit these in Colab (or override with command-line flags)
# ════════════════════════════════════════════════════════════════════════════
BACKEND_URL = "https://ultron-backend-pakd.onrender.com"  # your Render backend
MACHINE_ID  = "RAV-01"      # must match the device binding's Machine ID
IP          = "10.0.0.5"    # must match the device binding's IP (any label you pick)
PORT        = 8765          # must match the device binding's Port
INTERVAL    = 1.0           # seconds between pushes
# ════════════════════════════════════════════════════════════════════════════


def read_sensor() -> dict:
    """
    Return one reading as {"pressure": <bar>, "temperature": <degC>}.

    >>> REPLACE THIS with your real measurement source. <<<
    The default below generates realistic-looking demo values so you can verify
    the end-to-end flow immediately.
    """
    t = time.time()
    pressure    = round(7.0 + 1.2 * math.sin(t / 6.0) + random.uniform(-0.15, 0.15), 2)
    temperature = round(82.0 + 6.0 * math.sin(t / 11.0) + random.uniform(-0.4, 0.4), 2)
    return {"pressure": pressure, "temperature": temperature}


def push_forever(backend: str, machine_id: str, ip: str, port: int, interval: float) -> None:
    ingest_url = backend.rstrip("/") + "/api/bridges/ingest"
    print(f"[ULTRON] Pushing to {ingest_url} every {interval}s")
    print(f"[ULTRON] Reporting machine_id={machine_id!r} ip={ip!r} port={port}")
    print(f"[ULTRON] Bind a device with EXACTLY these values on the dashboard.\n")

    session = requests.Session()
    fails = 0
    while True:
        try:
            reading = read_sensor()
            payload = {
                "source": machine_id,
                "machine_id": machine_id,
                "ip": ip,
                "port": port,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                **reading,
            }
            resp = session.post(ingest_url, json=payload, timeout=30)
            resp.raise_for_status()
            msg = ""
            try:
                msg = resp.json().get("message", "")
            except Exception:
                pass
            routed = "ROUTED ✓" if msg == "matched" else "not matched (check binding)"
            print(f"  P={reading['pressure']:>6} bar  T={reading['temperature']:>6} °C  → {routed}")
            fails = 0
        except KeyboardInterrupt:
            print("\n[ULTRON] Stopped.")
            return
        except Exception as exc:
            fails += 1
            print(f"  ! push failed ({fails}): {exc}")
            # Render free tier may cold-start; back off a little then keep trying.
            if fails <= 3:
                time.sleep(2.0)
        time.sleep(interval)


def main() -> None:
    parser = argparse.ArgumentParser(description="Push live data to the ULTRON backend.")
    parser.add_argument("--backend", default=BACKEND_URL, help="Backend base URL")
    parser.add_argument("--machine-id", default=MACHINE_ID, help="Machine ID (must match binding)")
    parser.add_argument("--ip", default=IP, help="IP label (must match binding)")
    parser.add_argument("--port", type=int, default=PORT, help="Port (must match binding)")
    parser.add_argument("--interval", type=float, default=INTERVAL, help="Seconds between pushes")
    args = parser.parse_args()
    push_forever(args.backend, args.machine_id, args.ip, args.port, args.interval)


# In Colab there is no __main__/argv, so fall back to the CONFIG constants.
if __name__ == "__main__":
    if any(arg.startswith("--") for arg in sys.argv[1:]):
        main()
    else:
        push_forever(BACKEND_URL, MACHINE_ID, IP, PORT, INTERVAL)
