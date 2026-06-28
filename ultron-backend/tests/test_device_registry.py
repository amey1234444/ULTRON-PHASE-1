"""
ULTRON — Device registry / bridge-binding unit tests
====================================================
Covers strict (machine_id + ip) routing of pushed bridge readings to a device.

Run from ultron-backend/:
    pytest tests/test_device_registry.py -v
"""

import asyncio
import sqlite3

import pytest

from app import device_registry as dr
from app.bridge_manager import BridgeManager


def _run(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
        asyncio.set_event_loop(asyncio.new_event_loop())


@pytest.fixture(autouse=True)
def fresh_db():
    """Give each test an isolated in-memory device registry."""
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    dr.init_device_db(conn)
    dr._runtime.clear()
    dr._incoming.clear()
    yield
    conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
# Strict matching
# ═══════════════════════════════════════════════════════════════════════════════

class TestMatch:
    def test_no_binding_returns_none(self):
        assert dr.match("RAV-01", "192.168.1.50") is None

    def test_exact_machine_and_ip_matches(self):
        _run(dr.upsert_binding("rav-line-01", dr.DeviceBindingRequest(
            machine_id="RAV-01", ip="192.168.1.50", port=8765)))
        m = dr.match("RAV-01", "192.168.1.50")
        assert m is not None
        assert m["node_id"] == "rav-line-01"

    def test_machine_matches_but_ip_differs_returns_none(self):
        _run(dr.upsert_binding("rav-line-01", dr.DeviceBindingRequest(
            machine_id="RAV-01", ip="192.168.1.50", port=8765)))
        # Strict: machine_id alone is not enough.
        assert dr.match("RAV-01", "10.0.0.9") is None
        assert dr.match("RAV-99", "192.168.1.50") is None

    def test_two_devices_route_independently(self):
        _run(dr.upsert_binding("m1", dr.DeviceBindingRequest(
            machine_id="A", ip="192.168.1.1", port=8765)))
        _run(dr.upsert_binding("m2", dr.DeviceBindingRequest(
            machine_id="B", ip="192.168.1.2", port=8765)))
        assert dr.match("A", "192.168.1.1")["node_id"] == "m1"
        assert dr.match("B", "192.168.1.2")["node_id"] == "m2"
        # Crossed identities do not match.
        assert dr.match("A", "192.168.1.2") is None


# ═══════════════════════════════════════════════════════════════════════════════
# Runtime status
# ═══════════════════════════════════════════════════════════════════════════════

class TestRuntime:
    def test_record_incoming_tracks_matched_device(self):
        _run(dr.upsert_binding("rav-line-01", dr.DeviceBindingRequest(
            machine_id="RAV-01", ip="192.168.1.50", port=8765)))
        dr.record_incoming("RAV-01", "192.168.1.50", "203.0.113.7",
                           "rav-line-01", pressure=7.0, temperature=80.0)
        binding = dr.match("RAV-01", "192.168.1.50")
        assert binding["connected"] is True
        assert binding["last_source_ip"] == "203.0.113.7"
        assert binding["pressure"] == 7.0

    def test_record_incoming_lists_unmatched_sources(self):
        dr.record_incoming("UNKNOWN", "10.1.1.1", "203.0.113.7", None)
        keys = [s["machine_id"] for s in dr._incoming.values()]
        assert "UNKNOWN" in keys


# ═══════════════════════════════════════════════════════════════════════════════
# Bridge manager carries routing identity
# ═══════════════════════════════════════════════════════════════════════════════

class TestBridgeRouting:
    def test_ingest_attaches_machine_and_device_ids(self):
        async def run():
            mgr = BridgeManager()
            seen = []
            mgr.set_data_callback(lambda p, t, b: seen.append(b) or asyncio.sleep(0))
            bridge = await mgr.ingest(
                "RAV-01@192.168.1.50",
                {"pressure": 7.0, "temperature": 80.0},
                machine_id="RAV-01",
                device_node_id="rav-line-01",
            )
            assert bridge.machine_id == "RAV-01"
            assert bridge.device_node_id == "rav-line-01"
            d = bridge.to_dict()
            assert d["machineId"] == "RAV-01"
            assert d["deviceNodeId"] == "rav-line-01"
            assert seen[0].device_node_id == "rav-line-01"

        _run(run())
