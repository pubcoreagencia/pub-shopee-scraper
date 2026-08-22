import assert from "node:assert/strict";
import test from "node:test";
import { ShopeeProviderRouter } from "../../src/providers/ShopeeProviderRouter.js";
import { ShopeeErrorCode } from "../../src/types/errors.js";

test("ShopeeProviderRouter routes to Apify when token is configured", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any) => {
    const urlStr = String(url);
    if (urlStr.includes("/runs")) {
      return new Response(JSON.stringify({
        data: { status: "SUCCEEDED", defaultDatasetId: "dataset_abc" }
      }), { status: 200 });
    }
    if (urlStr.includes("/datasets/dataset_abc/items")) {
      return new Response(JSON.stringify([
        { shop_id: 1729928484, item_id: 12345, name: "Produto Teste", price: 5000 }
      ]), { status: 200 });
    }
    return new Response("Not Found", { status: 404 });
  };

  try {
    const router = new ShopeeProviderRouter({
      BROWSER: {} as any,
      APIFY_TOKEN: "mock_token",
    });

    const res = await router.scrape(
      { shopUsername: "9r18ht6m88", country: "br", limit: 5 },
      "req_123"
    );

    assert.equal(res.success, true);
    assert.equal(res.requestId, "req_123");
    assert.equal(res.provider, "apify");
    assert.equal(res.products.length, 1);
    assert.equal(res.metadata.fallbackUsed, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ShopeeProviderRouter handles empty catalog cleanly", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any) => {
    const urlStr = String(url);
    if (urlStr.includes("/runs")) {
      return new Response(JSON.stringify({
        data: { status: "SUCCEEDED", defaultDatasetId: "empty_dataset" }
      }), { status: 200 });
    }
    if (urlStr.includes("/datasets/empty_dataset/items")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    return new Response("Not Found", { status: 404 });
  };

  try {
    const router = new ShopeeProviderRouter({
      BROWSER: {} as any,
      APIFY_TOKEN: "mock_token",
    });

    const res = await router.scrape(
      { shopUsername: "empty_store", country: "br", limit: 5 },
      "req_empty"
    );

    assert.equal(res.success, true);
    assert.equal(res.products.length, 0);
    assert.ok(res.errors.some((e) => e.includes(ShopeeErrorCode.EMPTY_CATALOG)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ShopeeProviderRouter reports error when all providers are unavailable", async () => {
  const router = new ShopeeProviderRouter({
    BROWSER: undefined as any,
    APIFY_TOKEN: undefined,
  });

  const res = await router.scrape(
    { shopUsername: "9r18ht6m88", country: "br", limit: 5 },
    "req_fail"
  );

  assert.equal(res.success, false);
  assert.equal(res.provider, "none");
  assert.ok(res.errors.length > 0);
});
