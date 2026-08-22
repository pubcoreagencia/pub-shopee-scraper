import { ShopeeProduct, ShopeeShop } from "../types";

export function normalizePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  // If price is integer-like and >= 100, normalize from centavos (e.g. 4032 -> 40.32)
  if (Number.isInteger(num) && num >= 100) {
    return Math.round(num) / 100;
  }
  return num;
}

export function normalizeInternalPrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  // Shopee internal API price is in micro-units (e.g. 4032000 -> 40.32)
  if (num >= 100_000) {
    return num / 100_000;
  }
  if (num >= 100 && Number.isInteger(num)) {
    return num / 100;
  }
  return num;
}

export function extractFriendlyUsername(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 1) return null;

    const candidate = decodeURIComponent(segments[0]).trim();
    if (!candidate || /^shop$/i.test(candidate)) return null;
    if (/^\d{4,}$/.test(candidate)) return null;
    return candidate;
  } catch {
    return null;
  }
}

export function extractShopId(value: string): string | null {
  const patterns = [
    /\/shop\/(\d{4,})(?:[/?#]|$)/i,
    /(?:shopid|shop_id|shopId|shop-id)["'\s:=]+["']?(\d{4,})/i,
    /(?:shopid|shop_id|shopId|shop-id)[^0-9]{0,24}(\d{4,})/i,
    /[-.]i\.(\d{4,})\./i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function normalizeApifyItem(raw: any, fallbackShopId: string | null = null): ShopeeProduct | null {
  if (!raw || typeof raw !== "object") return null;

  const itemId = String(raw.item_id ?? raw.itemId ?? raw.id ?? raw.rawId ?? "").trim();
  if (!itemId) return null;

  const shopId = String(raw.shop_id ?? raw.shopId ?? "").trim() || fallbackShopId;
  const title = String(raw.name ?? raw.title ?? "").trim();
  const price = normalizePrice(raw.price ?? raw.priceMin);
  const originalPrice = normalizePrice(raw.original_price ?? raw.originalPrice ?? raw.priceBeforeDiscount);
  
  const stockRaw = Number(raw.stock ?? raw.normalStock);
  const stock = Number.isFinite(stockRaw) ? stockRaw : null;
  
  const sku = typeof raw.sku === "string" && raw.sku.trim() ? raw.sku.trim() : (typeof raw.itemSku === "string" && raw.itemSku.trim() ? raw.itemSku.trim() : null);

  const images: string[] = [];
  if (typeof raw.image_url === "string" && raw.image_url.trim()) {
    images.push(raw.image_url.trim());
  }
  if (Array.isArray(raw.images)) {
    for (const img of raw.images) {
      if (typeof img === "string" && img.trim() && !images.includes(img.trim())) {
        images.push(img.trim());
      }
    }
  }

  const productUrl = typeof raw.url === "string" && raw.url.trim()
    ? raw.url.trim()
    : (shopId ? `https://shopee.com.br/product/${shopId}/${itemId}` : "");

  const category = typeof raw.category === "string" ? raw.category : (typeof raw.categoryName === "string" ? raw.categoryName : null);
  const sellerName = typeof raw.seller === "string" ? raw.seller : (typeof raw.sellerName === "string" ? raw.sellerName : (typeof raw.shopName === "string" ? raw.shopName : null));

  return {
    itemId,
    shopId,
    title,
    price,
    originalPrice,
    stock,
    sku,
    images,
    category,
    sellerName,
    productUrl,
    metadata: raw,
  };
}

export function normalizeBrowserItem(raw: any, shopId: string | null = null): ShopeeProduct | null {
  if (!raw || typeof raw !== "object") return null;

  const basic = raw.item_basic ?? raw;
  const itemId = String(basic.itemid ?? basic.item_id ?? basic.id ?? "").trim();
  if (!itemId) return null;

  const itemShopId = String(basic.shopid ?? basic.shop_id ?? "").trim() || shopId;
  const title = String(basic.name ?? basic.title ?? "").trim();
  const price = normalizeInternalPrice(basic.price ?? basic.price_min);
  const originalPrice = normalizeInternalPrice(basic.price_before_discount ?? basic.original_price);
  
  const stockRaw = Number(basic.stock ?? basic.normal_stock);
  const stock = Number.isFinite(stockRaw) ? stockRaw : null;
  const sku = typeof basic.item_sku === "string" && basic.item_sku.trim() ? basic.item_sku.trim() : null;

  const images: string[] = [];
  if (Array.isArray(basic.images)) {
    for (const img of basic.images) {
      if (typeof img === "string" && img.trim()) {
        const fullImg = img.startsWith("http") ? img : `https://down-br.img.susercontent.com/file/${img.trim()}`;
        if (!images.includes(fullImg)) images.push(fullImg);
      }
    }
  }
  if (typeof basic.image === "string" && basic.image.trim()) {
    const fullImg = basic.image.startsWith("http") ? basic.image : `https://down-br.img.susercontent.com/file/${basic.image.trim()}`;
    if (!images.includes(fullImg)) images.push(fullImg);
  }

  const productUrl = typeof basic.url === "string" && basic.url.trim()
    ? basic.url.trim()
    : (itemShopId ? `https://shopee.com.br/product/${itemShopId}/${itemId}` : "");

  const category = typeof basic.category === "string" ? basic.category : (typeof basic.category_name === "string" ? basic.category_name : null);
  const sellerName = typeof basic.shop_name === "string" ? basic.shop_name : (typeof basic.seller_name === "string" ? basic.seller_name : null);

  return {
    itemId,
    shopId: itemShopId,
    title,
    price,
    originalPrice,
    stock,
    sku,
    images,
    category,
    sellerName,
    productUrl,
    metadata: raw,
  };
}
