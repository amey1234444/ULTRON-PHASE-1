/**
 * HealthMonitor.ts
 * Tracks connection quality metrics and triggers stale-data detection.
 *
 * Used by ConnectionManager to decide whether to switch transport.
 */

export interface HealthSnapshot {
  latencyMs:       number;
  dataStalenessMs: number;    // ms since last reading received
  readingsPerSec:  number;    // rolling 5-second average
  isStale:         boolean;   // true if no data for > staleThresholdMs
}

const ROLLING_WINDOW_MS = 5_000;
const STALE_THRESHOLD_MS = 3_000;  // no reading for 3 s = stale

export class HealthMonitor {
  private lastReadingMs    = 0;
  private latencyMs        = 0;
  private readingTimestamps: number[] = [];

  /** Call this each time a reading is successfully received. */
  recordReading(latencyMs: number): void {
    const now = Date.now();
    this.lastReadingMs = now;
    this.latencyMs     = latencyMs;

    // Maintain a rolling window of timestamps
    this.readingTimestamps.push(now);
    const cutoff = now - ROLLING_WINDOW_MS;
    this.readingTimestamps = this.readingTimestamps.filter((t) => t > cutoff);
  }

  getSnapshot(): HealthSnapshot {
    const now            = Date.now();
    const staleness      = this.lastReadingMs === 0 ? Infinity : now - this.lastReadingMs;
    const readingsPerSec = this.readingTimestamps.length / (ROLLING_WINDOW_MS / 1_000);

    return {
      latencyMs:       this.latencyMs,
      dataStalenessMs: staleness,
      readingsPerSec:  Math.round(readingsPerSec * 10) / 10,
      isStale:         staleness > STALE_THRESHOLD_MS,
    };
  }

  reset(): void {
    this.lastReadingMs    = 0;
    this.latencyMs        = 0;
    this.readingTimestamps = [];
  }
}
