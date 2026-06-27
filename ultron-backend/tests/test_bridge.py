"""
ULTRON — Bridge manager unit tests
===================================
Covers both data acquisition models:
  - pull  : backend polls a bridge's /api/live endpoint
  - push  : bridge POSTs readings to the backend's /api/bridges/ingest endpoint

All tests are self-contained (no network or physical hardware required).

Run from ultron-backend/:
    pytest tests/test_bridge.py -v
"""

import asyncio

import pytest

from app.bridge_manager import BridgeManager, _normalize_bridge_data


def _run(coro):
    """
    Run a coroutine on a dedicated event loop without disturbing global loop
    state for other tests. (asyncio.run() would close the loop and leave the
    main thread without a current loop, breaking tests that rely on the
    deprecated asyncio.get_event_loop() helper.)
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
        asyncio.set_event_loop(asyncio.new_event_loop())


# ═══════════════════════════════════════════════════════════════════════════════
# Normalization
# ═══════════════════════════════════════════════════════════════════════════════

class TestNormalize:
    def test_pressure_and_temperature_fields(self):
        out = _normalize_bridge_data({"pressure": 7.2, "temperature": 81.5})
        assert out["pressure"] == 7.2
        assert out["temperature"] == 81.5

    def test_alternate_field_names(self):
        out = _normalize_bridge_data({"pressureBar": 5.0, "temperatureC": 60.0})
        assert out["pressure"] == 5.0
        assert out["temperature"] == 60.0

    def test_pressure_percent_conversion(self):
        out = _normalize_bridge_data({"pressurePercent": 50.0, "temperature": 20.0})
        assert out["pressure"] == 5.0  # 50% of full-scale 10 bar

    def test_missing_values_default_to_zero(self):
        out = _normalize_bridge_data({"mode": "X"})
        assert out["pressure"] == 0.0
        assert out["temperature"] == 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# Push model (ingest)
# ═══════════════════════════════════════════════════════════════════════════════

class TestIngest:
    def test_ingest_creates_push_bridge_and_invokes_callback(self):
        async def run():
            mgr = BridgeManager()
            received = []
            mgr.set_data_callback(
                lambda p, t, b: received.append((p, t, b)) or asyncio.sleep(0)
            )

            bridge = await mgr.ingest("MACHINE-1", {"pressure": 7.0, "temperature": 80.0})

            assert bridge.is_push is True
            assert bridge.url == "push://MACHINE-1"
            assert bridge.status == "connected"
            assert bridge.poll_count == 1
            assert bridge.latest_data is not None
            assert bridge.latest_data["pressure"] == 7.0
            assert mgr.has_active_bridges is True

            # Same source reuses the same bridge entry (no duplicates)
            bridge2 = await mgr.ingest("MACHINE-1", {"pressure": 8.0, "temperature": 85.0})
            assert bridge2.id == bridge.id
            assert bridge2.poll_count == 2

            bridges = await mgr.list_bridges()
            assert len(bridges) == 1
            assert bridges[0]["isPush"] is True

            assert len(received) == 2
            assert received[0][0] == 7.0

        _run(run())

    def test_distinct_sources_create_distinct_bridges(self):
        async def run():
            mgr = BridgeManager()
            await mgr.ingest("A", {"pressure": 1.0, "temperature": 10.0})
            await mgr.ingest("B", {"pressure": 2.0, "temperature": 20.0})
            bridges = await mgr.list_bridges()
            assert len(bridges) == 2
            urls = {b["url"] for b in bridges}
            assert urls == {"push://A", "push://B"}

        _run(run())
