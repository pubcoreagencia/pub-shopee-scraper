import assert from "node:assert/strict";
import test from "node:test";
import { ApifyShopeeProvider } from "../../src/providers/apify/ApifyShopeeProvider.js";
import { ShopeeErrorCode, ShopeeScraperError } from "../../src/types/errors.js";

test("ApifyShopeeProvider throws PROVIDER_AUTH_ERROR when token is missing", async () => {
  const provider = new ApifyShopeeProvider("");
  await assert.rejects(
    async () => {
      await provider.fetchCatalog({ shopUsername: "9r18ht6m88", country: "br", limit: 10 });
    },
    (err: any) => err instanceof ShopeeScraperError && err.code === ShopeeErrorCode.PROVIDER_AUTH_ERROR
  );
});

test("ApifyShopeeProvider handles Apify 401 Unauthorized cleanly", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });

  try {
    const provider = new ApifyShopeeProvider("invalid_token");
    await assert.rejects(
      async () => {
        await provider.fetchCatalog({ shopUsername: "9r18ht6m88", country: "br", limit: 10 });
      },
      (err: any) => err instanceof ShopeeScraperError && err.code === ShopeeErrorCode.PROVIDER_AUTH_ERROR
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ApifyShopeeProvider handles Apify 429 Rate Limit cleanly", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Rate limited", { status: 429 });

  try {
    const provider = new ApifyShopeeProvider("valid_token");
    await assert.rejects(
      async () => {
        await provider.fetchCatalog({ shopUsername: "9r18ht6m88", country: "br", limit: 10 });
      },
      (err: any) => err instanceof ShopeeScraperError && err.code === ShopeeErrorCode.RATE_LIMIT
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ApifyShopeeProvider successfully parses mocked dataset items", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any) => {
    const urlStr = String(url);
    if (urlStr.includes("/runs")) {
      return new Response(JSON.stringify({
        data: {
          status: "SUCCEEDED",
          defaultDatasetId: "mock_dataset_123",
          usageTotalUsd: 0.04,
        }
      }), { status: 200 });
    }
    if (urlStr.includes("/datasets/mock_dataset_123/items")) {
      return new Response(JSON.stringify([
        {
          shop_id: 1729928484,
          item_id: 23299366739,
          name: "Babuche Infantil EVA",
          price: 4032,
          seller: "Zentta Babuche",
        }
      ]), { status: 200 });
    }
    return new Response("Not Found", { status: 404 });
  };

  try {
    const provider = new ApifyShopeeProvider("valid_token");
    const result = await provider.fetchCatalog({ shopUsername: "9r18ht6m88", country: "br", limit: 10 });

    assert.equal(result.provider, "apify");
    assert.equal(result.shop.shopId, "1729928484");
    assert.equal(result.products.length, 1);
    assert.equal(result.products[0].itemId, "23299366739");
    assert.equal(result.products[0].price, 40.32);
    assert.equal(result.costUsd, 0.04);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
