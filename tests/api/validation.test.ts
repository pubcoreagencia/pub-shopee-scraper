import assert from "node:assert/strict";
import test from "node:test";
import { validateScrapeRequest } from "../../src/api/validation.js";
import { ShopeeErrorCode } from "../../src/types/errors.js";

test("validateScrapeRequest accepts valid shopUrl", () => {
  const res = validateScrapeRequest({ shopUrl: "https://shopee.com.br/9r18ht6m88", limit: 10 });
  assert.equal(res.valid, true);
  assert.equal(res.data?.shopUrl, "https://shopee.com.br/9r18ht6m88");
  assert.equal(res.data?.shopUsername, "9r18ht6m88");
  assert.equal(res.data?.limit, 10);
});

test("validateScrapeRequest accepts valid shopUsername", () => {
  const res = validateScrapeRequest({ shopUsername: "9r18ht6m88" });
  assert.equal(res.valid, true);
  assert.equal(res.data?.shopUsername, "9r18ht6m88");
  assert.equal(res.data?.limit, 30); // default
});

test("validateScrapeRequest accepts valid shopId", () => {
  const res = validateScrapeRequest({ shopId: "1729928484", limit: 50 });
  assert.equal(res.valid, true);
  assert.equal(res.data?.shopId, "1729928484");
  assert.equal(res.data?.limit, 50);
});

test("validateScrapeRequest rejects foreign domains", () => {
  const res = validateScrapeRequest({ shopUrl: "https://mercadolivre.com.br/loja" });
  assert.equal(res.valid, false);
  assert.equal(res.errorCode, ShopeeErrorCode.INVALID_URL);
});

test("validateScrapeRequest rejects malformed / non-http URLs", () => {
  const res = validateScrapeRequest({ shopUrl: "javascript:alert(1)" });
  assert.equal(res.valid, false);
  assert.equal(res.errorCode, ShopeeErrorCode.INVALID_URL);
});

test("validateScrapeRequest rejects empty request without identifiers", () => {
  const res = validateScrapeRequest({});
  assert.equal(res.valid, false);
  assert.equal(res.errorCode, ShopeeErrorCode.INVALID_URL);
});

test("validateScrapeRequest clamps limit over MAX_LIMIT", () => {
  const res = validateScrapeRequest({ shopUsername: "9r18ht6m88", limit: 500 });
  assert.equal(res.valid, true);
  assert.equal(res.data?.limit, 100);
});

test("validateScrapeRequest rejects invalid limit format", () => {
  const res = validateScrapeRequest({ shopUsername: "9r18ht6m88", limit: -5 });
  assert.equal(res.valid, false);
  assert.equal(res.errorCode, ShopeeErrorCode.INVALID_RESPONSE);
});
