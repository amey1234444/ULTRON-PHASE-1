"""
ULTRON Colab/Cloud Bridge — push live data to the ULTRON backend from anywhere.

Run this from Google Colab, a cloud VM, or any machine with internet access.
It PUSHES sensor readings to the backend's /api/bridges/ingest endpoint, so it
works even when this machine is behind NAT / has no public IP (Colab included).

────────────────────────────────────────────────────────────────────────────
HOW ROUTING WORKS (read this once)
────────────────────────────────────────────────────────────────────────────
On the dashboard, drill down the asset hierarchy to the Equipment Type level
(e.g. Motor, Pump, Fan, Rotary Airlock Valve). Hover over the equipment type
card and click the 🔗 "Bridge binding" button. Set a Machine ID + IP + Port.

The backend routes a reading to that equipment type only when BOTH the MACHINE_ID
and the IP reported below match the binding EXACTLY. The IP is just a label you
choose — it does NOT have to be Colab's real address (Colab has none that the
backend can see). Pick any value, put the SAME value in the binding form and in
`IP` below.

Example binding on the dashboard:   Machine ID = TM-01,  IP = 10.11.11.5,  Port = 1111
Then set below:                     MACHINE_ID = "TM-01", IP = "10.11.11.5", PORT = 1111

────────────────────────────────────────────────────────────────────────────
USAGE
────────────────────────────────────────────────────────────────────────────
In Google Colab — paste this whole file into a cell, edit the CONFIG block, run.
  (Colab already has `requests` installed; nothing to pip install.)

As a script:
  python ultron_colab_bridge.py \
      --backend https://ultron-backend-pakd.onrender.com \
      --machine-id TM-01 --ip 10.11.11.5 --port 1111 --interval 1.0
"""

import argparse
import sys
import time
from datetime import datetime, timezone

import requests  # pre-installed in Colab; otherwise: pip install requests

# ════════════════════════════════════════════════════════════════════════════
# CONFIG — edit these in Colab (or override with command-line flags)
# ════════════════════════════════════════════════════════════════════════════
BACKEND_URL = "https://ultron-backend-pakd.onrender.com"  # your Render backend
MACHINE_ID  = "TM-01"      # must match the equipment type binding's Machine ID
IP          = "10.11.11.5"  # must match the equipment type binding's IP (any label you pick)
PORT        = 1111          # must match the equipment type binding's Port
INTERVAL    = 0.5           # seconds between pushes
# ════════════════════════════════════════════════════════════════════════════


class SensorSourceNotConfigured(RuntimeError):
    """Raised until this bridge is connected to a real measurement source."""


def read_sensor() -> dict:
    """
    Return one real reading as {"pressure": <bar>, "temperature": <degC>}.

    Wire this function to your real measurement source before running the bridge.
    It intentionally does not generate demo/simulated values, because every push
    is treated as live plant data by the backend once the binding matches.
    """
    raise SensorSourceNotConfigured(
        "read_sensor() is not connected to real hardware/data. "
        "Edit ultron_colab_bridge.py and return real pressure/temperature values."
    )


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
        except SensorSourceNotConfigured as exc:
            print(f"  ! bridge not started: {exc}")
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
