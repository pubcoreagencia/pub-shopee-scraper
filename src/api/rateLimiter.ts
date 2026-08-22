interface RateLimitEntry {
  timestamps: number[];
}

export class MemoryRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly storage = new Map<string, RateLimitEntry>();
  private lastCleanup = Date.now();

  constructor(maxRequests = 60, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    this.cleanup(now);

    let entry = this.storage.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.storage.set(key, entry);
    }

    // Filter out expired timestamps
    const threshold = now - this.windowMs;
    entry.timestamps = entry.timestamps.filter((ts) => ts > threshold);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldest = entry.timestamps[0] || now;
      const resetMs = Math.max(0, oldest + this.windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        resetMs,
      };
    }

    entry.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - entry.timestamps.length,
      resetMs: this.windowMs,
    };
  }

  private cleanup(now: number): void {
    if (now - this.lastCleanup < 60_000) return;
    this.lastCleanup = now;
    const threshold = now - this.windowMs;

    for (const [key, entry] of this.storage.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => ts > threshold);
      if (entry.timestamps.length === 0) {
        this.storage.delete(key);
      }
    }
  }
}

export const globalRateLimiter = new MemoryRateLimiter(60, 60_000);
