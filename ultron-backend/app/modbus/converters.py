"""
ULTRON Modbus Data Converters
==============================
Encode/decode Float32 and UInt32 values to/from pairs of 16-bit Modbus registers.

Byte order conventions follow the Modbus industry standard naming:
  ABCD — Big-endian            (most common; default for this system)
  CDAB — Word-swapped big-endian
  BADC — Byte-swapped little-endian
  DCBA — Little-endian

The four bytes of a 32-bit value are labelled A (MSB) … D (LSB).
"ABCD" means A is transmitted first (high byte of the high register).
"""

import struct
from typing import Tuple

ByteOrder = str  # one of "ABCD", "CDAB", "BADC", "DCBA"

VALID_BYTE_ORDERS: frozenset = frozenset({"ABCD", "CDAB", "BADC", "DCBA"})


def _reorder_4bytes(raw: bytes, byte_order: ByteOrder) -> bytes:
    """
    Reorder a 4-byte sequence from big-endian (ABCD) into the target byte order.
    ``raw`` must be exactly 4 bytes in big-endian layout.
    """
    if byte_order == "ABCD":
        return raw
    if byte_order == "CDAB":
        # Swap the two 16-bit words: [C D A B]
        return raw[2:4] + raw[0:2]
    if byte_order == "BADC":
        # Swap bytes within each word: [B A D C]
        return bytes([raw[1], raw[0], raw[3], raw[2]])
    if byte_order == "DCBA":
        # Full reversal: [D C B A]
        return raw[::-1]
    raise ValueError(
        f"Unknown byte order '{byte_order}'. Valid values: {sorted(VALID_BYTE_ORDERS)}"
    )


def _unreorder_4bytes(raw: bytes, byte_order: ByteOrder) -> bytes:
    """
    Reverse the byte reordering applied by ``_reorder_4bytes`` to recover
    the original big-endian layout.  For ABCD and DCBA the operation is
    self-inverse; for CDAB and BADC it is also self-inverse, so this
    function is identical to ``_reorder_4bytes``.
    """
    # All four permutations used here happen to be self-inverse.
    return _reorder_4bytes(raw, byte_order)


# ── Float32 ───────────────────────────────────────────────────────────────────

def float_to_registers(value: float, byte_order: ByteOrder = "ABCD") -> Tuple[int, int]:
    """
    Encode a 32-bit IEEE 754 float into two 16-bit Modbus input registers.

    Returns ``(high_register, low_register)`` where ``high_register`` is placed
    at the lower Modbus address (e.g. 30001) and ``low_register`` at the next
    address (e.g. 30002).

    Example (ABCD / big-endian):
        float_to_registers(7.35) → (0x40EB, 0x851F)
    """
    if byte_order not in VALID_BYTE_ORDERS:
        raise ValueError(
            f"Unknown byte order '{byte_order}'. Valid values: {sorted(VALID_BYTE_ORDERS)}"
        )
    raw = struct.pack(">f", float(value))          # always start from big-endian
    reordered = _reorder_4bytes(raw, byte_order)
    high = struct.unpack(">H", reordered[0:2])[0]
    low  = struct.unpack(">H", reordered[2:4])[0]
    return high, low


def registers_to_float(high: int, low: int, byte_order: ByteOrder = "ABCD") -> float:
    """
    Decode two 16-bit Modbus registers back into a 32-bit IEEE 754 float.

    ``high`` is the register at the lower Modbus address.
    """
    if byte_order not in VALID_BYTE_ORDERS:
        raise ValueError(
            f"Unknown byte order '{byte_order}'. Valid values: {sorted(VALID_BYTE_ORDERS)}"
        )
    raw = struct.pack(">HH", high, low)
    original = _unreorder_4bytes(raw, byte_order)
    return struct.unpack(">f", original)[0]


# ── UInt32 ────────────────────────────────────────────────────────────────────

def uint32_to_registers(value: int) -> Tuple[int, int]:
    """
    Encode a 32-bit unsigned integer into two 16-bit Modbus registers.

    Always uses big-endian (high word first) per standard Modbus convention.
    Values exceeding 2³²−1 are masked to fit without raising an error.

    Returns ``(high_register, low_register)``.
    """
    value = int(value) & 0xFFFFFFFF
    high = (value >> 16) & 0xFFFF
    low  =  value        & 0xFFFF
    return high, low


def registers_to_uint32(high: int, low: int) -> int:
    """Decode two 16-bit Modbus registers into a 32-bit unsigned integer."""
    return ((high & 0xFFFF) << 16) | (low & 0xFFFF)
