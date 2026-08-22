import assert from "node:assert/strict";
import test from "node:test";
import {
  extractFriendlyUsername,
  extractShopId,
  normalizeApifyItem,
  normalizeBrowserItem,
  normalizeInternalPrice,
  normalizePrice,
} from "../../src/normalizers/shopeeProductNormalizer.js";

test("normalizePrice converts centavos to BRL", () => {
  assert.equal(normalizePrice(4032), 40.32);
  assert.equal(normalizePrice(4443), 44.43);
  assert.equal(normalizePrice(40.32), 40.32);
  assert.equal(normalizePrice(0), null);
  assert.equal(normalizePrice(-50), null);
  assert.equal(normalizePrice(null), null);
});

test("normalizeInternalPrice converts Shopee micros to BRL", () => {
  assert.equal(normalizeInternalPrice(4032000), 40.32);
  assert.equal(normalizeInternalPrice(10080000), 100.8);
  assert.equal(normalizeInternalPrice(4032), 40.32);
  assert.equal(normalizeInternalPrice(0), null);
});

test("extractFriendlyUsername extracts handle from URL", () => {
  assert.equal(extractFriendlyUsername("https://shopee.com.br/9r18ht6m88"), "9r18ht6m88");
  assert.equal(extractFriendlyUsername("https://shopee.com.br/minha_loja.oficial"), "minha_loja.oficial");
  assert.equal(extractFriendlyUsername("https://shopee.com.br/shop/1729928484"), null);
  assert.equal(extractFriendlyUsername("https://shopee.com.br/1729928484"), null);
  assert.equal(extractFriendlyUsername("https://shopee.com.br/"), null);
});

test("extractShopId extracts numeric id from paths and parameters", () => {
  assert.equal(extractShopId("https://shopee.com.br/shop/1729928484"), "1729928484");
  assert.equal(extractShopId("https://shopee.com.br/product-name-i.1729928484.23299366739"), "1729928484");
  assert.equal(extractShopId("shopid=1729928484"), "1729928484");
  assert.equal(extractShopId("https://shopee.com.br/9r18ht6m88"), null);
});

test("normalizeApifyItem converts raw Apify record to ShopeeProduct", () => {
  const raw = {
    shop_id: 1729928484,
    item_id: 23299366739,
    name: "Babuche Infantil EVA",
    price: 4032,
    image_url: "https://down-br.img.susercontent.com/file/sample.jpg",
    seller: "Zentta Babuche",
  };

  const product = normalizeApifyItem(raw);
  assert.ok(product);
  assert.equal(product.itemId, "23299366739");
  assert.equal(product.shopId, "1729928484");
  assert.equal(product.title, "Babuche Infantil EVA");
  assert.equal(product.price, 40.32);
  assert.equal(product.sellerName, "Zentta Babuche");
  assert.deepEqual(product.images, ["https://down-br.img.susercontent.com/file/sample.jpg"]);
  assert.equal(product.productUrl, "https://shopee.com.br/product/1729928484/23299366739");
});

test("normalizeBrowserItem converts raw Playwright item to ShopeeProduct", () => {
  const raw = {
    item_basic: {
      itemid: 23299366739,
      shopid: 1729928484,
      name: "Babuche Infantil EVA",
      price: 4032000,
      price_before_discount: 10080000,
      stock: 50,
      image: "sg-11134201-8261r-mm76a9htyw3la4",
      shop_name: "Zentta Babuche",
    },
  };

  const product = normalizeBrowserItem(raw);
  assert.ok(product);
  assert.equal(product.itemId, "23299366739");
  assert.equal(product.shopId, "1729928484");
  assert.equal(product.price, 40.32);
  assert.equal(product.originalPrice, 100.8);
  assert.equal(product.stock, 50);
  assert.equal(product.sellerName, "Zentta Babuche");
  assert.deepEqual(product.images, ["https://down-br.img.susercontent.com/file/sg-11134201-8261r-mm76a9htyw3la4"]);
});
