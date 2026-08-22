import assert from "node:assert/strict";
import test from "node:test";
import { MemoryRateLimiter } from "../../src/api/rateLimiter.js";

test("MemoryRateLimiter allows requests up to maxRequests and blocks afterwards", () => {
  const limiter = new MemoryRateLimiter(3, 5000);
  const ip = "192.168.1.100";

  assert.equal(limiter.isAllowed(ip).allowed, true);
  assert.equal(limiter.isAllowed(ip).allowed, true);
  assert.equal(limiter.isAllowed(ip).allowed, true);

  const blocked = limiter.isAllowed(ip);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.resetMs > 0);
});

test("MemoryRateLimiter isolates different clients", () => {
  const limiter = new MemoryRateLimiter(2, 5000);
  const ipA = "10.0.0.1";
  const ipB = "10.0.0.2";

  assert.equal(limiter.isAllowed(ipA).allowed, true);
  assert.equal(limiter.isAllowed(ipA).allowed, true);
  assert.equal(limiter.isAllowed(ipA).allowed, false);

  assert.equal(limiter.isAllowed(ipB).allowed, true);
});
