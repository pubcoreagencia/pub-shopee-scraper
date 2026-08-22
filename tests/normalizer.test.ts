import { normalizeApifyItem, normalizeBrowserItem, normalizePrice } from "../src/normalizers/shopeeProductNormalizer";

// Quick test validation for price and structure normalization
const testRawApify = {
  shop_id: 1729928484,
  item_id: 23299366739,
  name: "Babuche Infantil EVA",
  price: 4032,
  image_url: "https://down-br.img.susercontent.com/file/sample.jpg",
  seller: "Zentta Babuche",
};

const normalized = normalizeApifyItem(testRawApify);
if (!normalized || normalized.price !== 40.32 || normalized.itemId !== "23299366739") {
  throw new Error("Normalizer unit test failed");
}
console.log("Normalizer unit test passed!");
