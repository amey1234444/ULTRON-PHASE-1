use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModbusSensorReading {
    pub pressure:    f32,
    pub temperature: f32,
}

/// Read Pressure + Temperature from the Pi's Modbus TCP server.
///
/// Register map (FC4 Input Registers, ABCD / Big-Endian Float32):
///   30001-30002  → Pressure    (bar)
///   30003-30004  → Temperature (°C)
pub async fn read_sensor_registers(
    host:     &str,
    port:     u16,
    slave_id: u8,
) -> Result<ModbusSensorReading, String> {
    // Build FC4 request ADU
    //   MBAP:  [TxID(2) | Proto=0x0000(2) | Len(2) | UnitID(1)]
    //   PDU:   [FC=0x04(1) | StartAddr(2) | Quantity(2)]
    let req: [u8; 12] = [
        0x00, 0x01,  // Transaction ID
        0x00, 0x00,  // Protocol ID (Modbus TCP)
        0x00, 0x06,  // Length of bytes that follow in the frame
        slave_id,    // Unit / Slave ID
        0x04,        // Function Code: Read Input Registers
        0x00, 0x00,  // Starting address (0 = register 30001)
        0x00, 0x04,  // Quantity of registers (4 registers = 2 × Float32)
    ];

    let addr = format!("{}:{}", host, port);

    let mut stream = timeout(
        Duration::from_millis(1_500),
        TcpStream::connect(&addr),
    )
    .await
    .map_err(|_| format!("Connection timeout to {}", addr))?
    .map_err(|e| format!("TCP connect error: {}", e))?;

    timeout(Duration::from_millis(500), stream.write_all(&req))
        .await
        .map_err(|_| "Write timeout".to_string())?
        .map_err(|e| format!("Write error: {}", e))?;

    // Expected response layout:
    //   MBAP (7 bytes) + FC (1) + ByteCount (1) + Data (8) = 17 bytes
    let mut buf = [0u8; 32];
    let n = timeout(Duration::from_millis(1_000), stream.read(&mut buf))
        .await
        .map_err(|_| "Read timeout".to_string())?
        .map_err(|e| format!("Read error: {}", e))?;

    if n < 17 {
        return Err(format!(
            "Modbus response too short: {} bytes (expected ≥17)",
            n
        ));
    }

    // Byte 7 = function code in response
    if buf[7] == 0x84 {
        return Err(format!(
            "Modbus exception on FC4: error code 0x{:02X}",
            buf[8]
        ));
    }
    if buf[7] != 0x04 {
        return Err(format!(
            "Unexpected function code in response: 0x{:02X}",
            buf[7]
        ));
    }

    // ABCD (Big-Endian) Float32 decoding:
    //   bytes 9-12  → Pressure    (registers 0-1)
    //   bytes 13-16 → Temperature (registers 2-3)
    let pressure    = f32::from_be_bytes([buf[9], buf[10], buf[11], buf[12]]);
    let temperature = f32::from_be_bytes([buf[13], buf[14], buf[15], buf[16]]);

    if !pressure.is_finite() || !temperature.is_finite() {
        return Err(
            "Decoded non-finite value — verify register map and byte order".to_string()
        );
    }

    Ok(ModbusSensorReading { pressure, temperature })
}
