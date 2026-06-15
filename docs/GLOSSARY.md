# GLOSSARY.md
## ULTRON — Project Terminology

**Purpose:** Define all project-specific, industrial, and technical terms used across ULTRON documentation and codebase.
**Last Updated:** 2026-06-02
**Audience:** All — engineers, hardware team, interns, AI agents

> When you encounter an unfamiliar term in this project, look it up here first.
> If it is missing, add it.

---

## A

**Accelerometer**
A sensor that measures vibration or acceleration. In ULTRON, used for bearing vibration monitoring (tags V1, V2). Outputs either an analog signal (IEPE) or 4–20 mA RMS value.

**ADC (Analog-to-Digital Converter)**
An electronic circuit that converts an analog voltage (continuous) to a digital number. Required on Raspberry Pi because the Pi has no onboard ADC. ULTRON uses the ADS1115 (16-bit, I2C). Used to read 4–20 mA sensors (converted to 1–5 V via shunt resistor).

**ADS1115**
A 16-bit 4-channel I2C ADC made by Texas Instruments. Used in ULTRON to convert 4–20 mA pressure sensor output to a digital reading on the Raspberry Pi. Default I2C address: 0x48. Library: `adafruit-circuitpython-ads1x15`.

**Alarm**
A notification triggered when a sensor value exceeds a defined threshold. ULTRON has two alarm levels: Warning and Critical. See also: Warning, Critical, Health Score.

**App Phase**
ULTRON Desktop's top-level state. Values: `splash`, `discovery`, `connected`, `simulation`, `settings`, `diagnostics`. Controls which page is shown. Managed by `appStore.ts`.

---

## B

**Backend**
The Python FastAPI server (`ultron-backend/`) that reads sensors, serves the REST API, streams WebSocket data, and runs the Modbus server. Runs on Raspberry Pi in production, runs on any OS in simulation mode.

**Bearing**
A mechanical component that supports a rotating shaft and reduces friction. In a rotary airlock valve, bearings support the rotor shaft at both ends (drive-side and non-drive-side). Bearing failure is one of the most common causes of machine downtime.

**BPFI / BPFO / BSF / FTF**
Bearing fault characteristic frequencies used in vibration analysis (FFT):
- **BPFI** = Ball Pass Frequency Inner race
- **BPFO** = Ball Pass Frequency Outer race
- **BSF** = Ball Spin Frequency
- **FTF** = Fundamental Train Frequency

**BT1 / BT2**
Sensor tags for Drive-Side Bearing Temperature and Non-Drive-Side Bearing Temperature. Units: °C. Phase 2 sensors. See [SENSORS.md](SENSORS.md).

---

## C

**Callout**
The label and connecting line on the digital twin SVG that points from a sensor dot to a text label. Each sensor point has a `calloutX`, `calloutY`, and `calloutSide` defining where its label appears.

**Cargo**
The Rust package manager and build tool. Used to compile the Tauri native layer (`ultron-desktop/src-tauri/`).

**Critical**
The highest alarm severity in ULTRON. Triggered when:
- Pressure ≥ 10.45 bar
- Temperature ≥ 109.25 °C

Visual indicator: red (`--crit: #FF4040`).

**CSS Variable**
A CSS custom property (e.g., `var(--panel)`) used throughout ULTRON's UI for theming. Defined in `src/index.css`. All colors must use CSS variables — never hardcoded hex values in components.

**CT (Current Transformer)**
A device that measures electrical current by induction. Clamps around a conductor. Used for M1 (Motor Current) monitoring. Outputs a small secondary current proportional to the primary current.

---

## D

**DP (Differential Pressure)**
The pressure difference between two points. In ULTRON: DP1 = P1 (inlet) − P2 (outlet). Used to assess the airlock seal integrity of the rotary valve. Tag: DP1.

**Digital Twin**
A virtual model of a physical machine shown in the ULTRON dashboard. In Phase 1, this is the Rotary Airlock Valve SVG with sensor dots overlaid at each sensor's physical location. File: `RotaryAirlockValveSvg.tsx`. See [PROCESS_OVERVIEW.md](PROCESS_OVERVIEW.md).

**DS (Drive Side)**
The end of the rotor shaft where the motor and gearbox are connected. Also called the motor end or driven end. Contrast: NDS (Non-Drive Side). Tags on drive side: BT1, V1.

---

## E

**ECharts**
Apache ECharts — the JavaScript charting library used in ULTRON for gauges and trend charts. Used via `echarts-for-react`. See [UI_UX.md](UI_UX.md).

**Edge Device**
A computing device deployed at the physical location of the machine (as opposed to in the cloud). In ULTRON Phase 1, the edge device is a Raspberry Pi 4. It reads sensors and serves data locally.

**EMA (Exponential Moving Average)**
A mathematical smoothing filter applied to raw sensor readings in the simulator. Formula: `smoothed = α × raw + (1 − α) × smoothed`. Higher α = less smoothing. Used to model sensor inertia.

---

## F

**FC4 (Function Code 4)**
Modbus function code for "Read Input Registers". All ULTRON sensor data is exposed via FC4. Read-only. Input Registers have display addresses starting at 30001.

**FastAPI**
Python web framework used for the ULTRON backend. Provides REST endpoints, WebSocket support, automatic OpenAPI documentation, and Pydantic integration. Runs on Uvicorn.

**FFT (Fast Fourier Transform)**
An algorithm that converts a time-domain vibration signal into frequency domain. Used in Phase 3 to identify bearing fault frequencies from vibration data.

**Float32**
IEEE 754 single-precision floating-point number. 32 bits (4 bytes). Used for all process values in ULTRON Modbus registers. Stored as two consecutive 16-bit registers in ABCD byte order by default.

**FLC (Full Load Current)**
The rated current of an electric motor at full load, as shown on the motor nameplate. Used to set alarm thresholds for M1 (Motor Current). Warning: 110% FLC, Critical: 125% FLC.

---

## G

**Gateway**
An edge device that connects multiple sensor nodes or sub-devices via Modbus RTU and aggregates their data into a single WebSocket/Modbus TCP stream. Phase 4 architecture. Contrast: single Raspberry Pi edge device (Phase 1).

**Gearbox**
A speed-reducing mechanical device between the motor and the rotor shaft. Converts high-speed motor rotation to low-speed rotor rotation. A common source of vibration and bearing temperature issues.

**GPIO (General Purpose Input/Output)**
The header pins on Raspberry Pi used for digital I/O. ULTRON uses GPIO 27 for DS18B20 1-Wire temperature sensing. GPIO 17 is reserved for pressure (though actual pressure uses I2C ADS1115).

---

## H

**Hardware Mode**
ULTRON backend mode where real GPIO/I2C sensors are read. Activated by `SIMULATED=false` in `.env`. Contrast: Simulation Mode.

**Health Score**
A single number (0–100) that summarizes overall machine health. Computed from pressure and temperature in Phase 1. Displayed as a donut gauge in the dashboard. 100 = perfectly healthy. Computed in `utils/formatters.ts`.

**Holding Register**
Modbus register type (FC3, 4xxxx) for read/write configuration values. In ULTRON Phase 1, Holding Registers are reserved but not yet implemented. Contrast: Input Register.

---

## I

**I2C (Inter-Integrated Circuit)**
A serial communication protocol used to connect the ADS1115 ADC to the Raspberry Pi. Uses two pins: SDA (GPIO 2) and SCL (GPIO 3). Supports multiple devices on the same bus (different addresses).

**IEPE (Integrated Electronics Piezo-Electric)**
A type of accelerometer with built-in electronics. Requires a constant current supply (typically 2–10 mA). Outputs an AC-coupled voltage proportional to acceleration. Used for Phase 3 FFT vibration analysis.

**Input Register**
Modbus register type (FC4, 3xxxx) for read-only process values. All ULTRON sensor data is in Input Registers. Contrast: Holding Register.

---

## L

**Lifespan**
FastAPI's `lifespan` async context manager — the startup/shutdown hook for the ULTRON backend. Initialises sensors, starts Modbus servers, starts mDNS advertisement, and launches the sensor loop.

---

## M

**M1**
Sensor tag for Motor Current. Units: A (Amperes). Phase 2 sensor. Measured via current transformer (CT) in the motor control panel. See [SENSORS.md](SENSORS.md).

**MCC (Motor Control Centre)**
An electrical panel that contains motor starters, circuit breakers, and controls. The location where current transformers (M1) are installed.

**mDNS (multicast DNS)**
A zero-configuration networking protocol that allows devices to advertise themselves on a local network without a central DNS server. ULTRON uses mDNS service type `_ultron._tcp.local.` for auto-discovery. Library: Python `zeroconf`.

**Modbus**
An industrial communication protocol. ULTRON implements Modbus as a slave (server). Two variants:
- **Modbus TCP** — over Ethernet/IP (port 5020 dev, 502 production)
- **Modbus RTU** — over RS485 serial bus

See [MODBUS.md](MODBUS.md).

**MT1 / MT2**
Sensor tags for Material Temperature. MT1 = Inlet Material Temperature, MT2 = Outlet Material Temperature. Units: °C. MT2 is active in Phase 1. See [SENSORS.md](SENSORS.md).

---

## N

**NDS (Non-Drive Side)**
The end of the rotor shaft opposite to the motor/gearbox. Also called the free end or anti-drive end. Tags on NDS: BT2, V2.

**NavySteelPalette**
Informal name for the ULTRON Option 3 SCADA dark theme: deep navy backgrounds, steel-blue text, electric blue accent, vivid status colors. Locked design decision. See [DECISIONS.md — ADR-001](DECISIONS.md).

---

## O

**OPC-UA (Open Platform Communications Unified Architecture)**
An advanced industrial communication standard. Future roadmap (Phase 5+). More capable than Modbus but more complex. Not yet implemented.

**Option 3 SCADA**
The selected and locked UI design theme for ULTRON. Navy-steel dark industrial palette. See [DECISIONS.md — ADR-001](DECISIONS.md) and [UI_UX.md](UI_UX.md).

---

## P

**P1 / P2**
Sensor tags for pressure measurements. P1 = Inlet Pressure (active, Phase 1), P2 = Outlet Pressure (future). Units: bar. See [SENSORS.md](SENSORS.md).

**PDU Address**
The raw register address used inside Modbus packets. Starts at 0. Contrast: Display Address (PDU + 30001 for Input Registers).

**Phase 1 / Phase 2 / etc.**
Development phases for ULTRON. See [ROADMAP.md](ROADMAP.md).
- Phase 1: MVP — pressure + temperature
- Phase 2: Bearing temps + RPM + current
- Phase 3: Vibration + FFT + predictive maintenance
- Phase 4: Hardware platform (UM Card, TP Card, multi-machine)
- Phase 5: Cloud platform

**Process Overview**
The panel in the ULTRON dashboard that shows the digital twin SVG of the machine with live sensor data overlaid. Implemented in `ProcessOverview.tsx`. Supports click-to-fullscreen.

**Predictive Maintenance**
Maintenance performed based on condition monitoring (sensor data trends) rather than on a fixed time schedule. The goal is to detect failure before it happens. Phase 3 feature.

**PT100**
A resistance temperature detector (RTD) made of platinum. Resistance = 100 Ω at 0 °C. More accurate than thermocouples for the temperature range of this application. Used with a 4–20 mA transmitter head for industrial installation.

---

## R

**RAV (Rotary Airlock Valve)**
The machine monitored in Phase 1. Also called: rotary feeder, rotary valve, star feeder, airlock feeder. Transfers bulk solids while maintaining a pressure seal. Machine tag: RAV-01.

**Raspberry Pi 4**
The edge computing device used in ULTRON Phase 1. 8 GB RAM recommended. Runs Python FastAPI backend, reads sensors via GPIO/I2C, serves WebSocket and Modbus TCP/RTU.

**Register**
A 16-bit (2 byte) data word in a Modbus device. Process values occupy multiple registers: Float32 = 2 registers, UInt32 = 2 registers, UInt16 = 1 register.

**RPM1**
Sensor tag for Rotor Speed. Units: rpm. Phase 2 sensor. Measured with an inductive proximity sensor and pulse counting on Raspberry Pi GPIO. See [SENSORS.md](SENSORS.md).

**RS485**
A differential serial communication standard used for Modbus RTU. Two wires (A+, B−), half-duplex, up to 1200 m cable at 9600 baud. Electrically robust in industrial environments.

**RTU (Remote Terminal Unit)**
In Modbus context: Modbus RTU = Modbus over serial (RS485). Not to be confused with physical RTU devices.

---

## S

**SCADA (Supervisory Control and Data Acquisition)**
Industrial monitoring and control software platform. Examples: Ignition, WonderWare, Citect. ULTRON integrates with SCADA systems via Modbus TCP. ULTRON itself is also a monitoring system in this category.

**Sensor Loop**
The core asyncio background task in the ULTRON backend. Runs every 100 ms: reads both sensors concurrently, broadcasts to WebSocket clients, updates Modbus registers.

**Sensor Point**
A data structure in the ULTRON frontend representing one sensor on the digital twin. Contains: tag, name, unit, value, status, installed flag, phase, SVG coordinates. Type: `SensorPoint` in `types.ts`.

**Simulation Mode**
ULTRON backend mode where realistic fake sensor data is generated by software instead of reading real hardware. Activated by `SIMULATED=true` (default). Contrast: Hardware Mode.

**SensorReading**
The primary data model in ULTRON. Contains: `timestamp`, `pressure`, `temperature`, `status`. This is the payload of every WebSocket message. Defined in `models.py` (Python) and `sensor.ts` (TypeScript).

---

## T

**Tag**
A short identifier for a sensor measurement point. Convention: instrument type prefix + number. Examples: P1, MT2, BT1. See [HARDWARE.md § 6](HARDWARE.md#6-hardware-tag-definitions).

**Tauri**
A Rust-based framework for building desktop applications with web technologies (HTML/CSS/JavaScript). ULTRON uses Tauri 2.x to package the React frontend into a native Windows/Linux `.exe`. See [DECISIONS.md — ADR-002](DECISIONS.md).

**TP Card (Temperature & Process Card)**
A planned ULTRON hardware module for Phase 4. Handles RTD and thermocouple inputs with signal conditioning. Communicates via Modbus RTU to the gateway.

**Thermowell**
A protective sleeve installed in a pipe or duct that allows a temperature sensor to be inserted, removed, and replaced without shutting down the process.

---

## U

**UM Card (Universal Measurement Card)**
A planned ULTRON hardware module for Phase 4. Multi-channel industrial ADC with signal conditioning for 4–20 mA, voltage, and IEPE inputs. Communicates via Modbus RTU. Device type code: 2 (register 30214).

**Uvicorn**
An ASGI (Asynchronous Server Gateway Interface) web server for Python. Used to run the FastAPI application. Handles HTTP and WebSocket connections.

---

## V

**V1 / V2**
Sensor tags for vibration measurements. V1 = Drive-Side Vibration, V2 = NDS Vibration. Units: mm/s (RMS velocity). Phase 3 sensors. See [SENSORS.md](SENSORS.md).

**ViewBox**
SVG attribute defining the coordinate space of the diagram. ULTRON's rotary airlock valve SVG uses `viewBox="0 0 900 560"`. Sensor dot coordinates refer to this coordinate system.

---

## W

**Warning**
The first-level alarm severity in ULTRON. Triggered when:
- Pressure ≥ 8.8 bar (80% of max 11 bar)
- Temperature ≥ 92.0 °C (80% of max 115 °C)

Visual indicator: amber (`--warn: #FFB020`).

**WebSocket**
A bidirectional network protocol over TCP. ULTRON uses WebSocket to stream sensor data from the backend to the desktop app at 10 Hz. Endpoint: `ws://host:8000/ws`. See [PROTOCOLS.md](PROTOCOLS.md).

**Wireless Node**
A planned Phase 4 ULTRON hardware module. Battery-powered sensor node for measuring points that are difficult to reach with cables. Communicates wirelessly to the gateway.

---

## Z

**ZS1**
Sensor tag for Zero-Speed Detection. Binary output: 0 = shaft running, 1 = shaft stopped. Phase 2 sensor. A ZS1=1 while the machine should be running triggers a Critical alarm. See [SENSORS.md](SENSORS.md).

**Zeroconf**
A set of technologies for automatic network configuration without manual IP assignment. ULTRON uses Zeroconf/mDNS to advertise the Raspberry Pi's IP address on the local network. Python library: `zeroconf`.

**Zustand**
A lightweight React state management library used in ULTRON frontend. Three stores: `sensorStore`, `connectionStore`, `appStore`. See [SOFTWARE.md § 5](SOFTWARE.md#5-state-management).
