/**
 * Seller Lead Extractor
 * Converts normalized Shopee product/shop data into qualified B2B leads
 * for downstream growth/outreach pipelines.
 */

import type { NormalizedShopeeProduct, NormalizedShopeeShop } from './shopeeProductNormalizer';

export type LeadTier = 'HOT' | 'WARM' | 'COLD';

export interface SellerLead {
  leadId: string;
  shopId: string | number;
  shopName: string;
  username?: string;
  tier: LeadTier;
  score: number;
  signals: LeadSignal[];
  productCount: number;
  estimatedMonthlyRevenue?: number;
  contactChannels: LeadContactChannel[];
  extractedAt: string;
  raw: {
    shop: Partial<NormalizedShopeeShop>;
    products: NormalizedShopeeProduct[];
  };
}

export interface LeadSignal {
  code: string;
  label: string;
  weight: number;
}

export interface LeadContactChannel {
  type: 'chat' | 'shop_link' | 'social';
  value: string;
}

export interface LeadExtractionOptions {
  hotScoreThreshold?: number;
  warmScoreThreshold?: number;
  includeProductSamples?: number;
  now?: () => Date;
}

const DEFAULT_OPTIONS: Required<LeadExtractionOptions> = {
  hotScoreThreshold: 70,
  warmScoreThreshold: 40,
  includeProductSamples: 5,
  now: () => new Date(),
};

function deterministicId(parts: (string | number)[]): string {
  return parts
    .filter((p) => p !== undefined && p !== null)
    .map((p) => String(p).replace(/[^a-zA-Z0-9_-]/g, ''))
    .join('-');
}

function computeTier(score: number, opts: Required<LeadExtractionOptions>): LeadTier {
  if (score >= opts.hotScoreThreshold) return 'HOT';
  if (score >= opts.warmScoreThreshold) return 'WARM';
  return 'COLD';
}

function extractSignals(
  shop: Partial<NormalizedShopeeShop>,
  products: NormalizedShopeeProduct[]
): { score: number; signals: LeadSignal[] } {
  const signals: LeadSignal[] = [];
  let score = 0;

  // Signal: shop is verified / official
  const isVerified = Boolean(
    shop.isOfficial || shop.isPreferred || shop.isMall || shop.shopRating >= 4.7
  );
  if (isVerified) {
    signals.push({ code: 'VERIFIED_SELLER', label: 'Verified / Mall seller', weight: 25 });
    score += 25;
  }

  // Signal: rating quality
  const rating = typeof shop.shopRating === 'number' ? shop.shopRating : 0;
  if (rating >= 4.5) {
    signals.push({ code: 'HIGH_RATING', label: `High rating (${rating})`, weight: 15 });
    score += 15;
  } else if (rating >= 4.0 && rating > 0) {
    signals.push({ code: 'GOOD_RATING', label: `Good rating (${rating})`, weight: 8 });
    score += 8;
  }

  // Signal: follower count (reach)
  const followers = typeof shop.followerCount === 'number' ? shop.followerCount : 0;
  if (followers >= 100000) {
    signals.push({ code: 'LARGE_AUDIENCE', label: `Large audience (${followers})`, weight: 20 });
    score += 20;
  } else if (followers >= 10000) {
    signals.push({ code: 'MEDIUM_AUDIENCE', label: `Medium audience (${followers})`, weight: 12 });
    score += 12;
  } else if (followers >= 1000) {
    signals.push({ code: 'SMALL_AUDIENCE', label: `Growing audience (${followers})`, weight: 5 });
    score += 5;
  }

  // Signal: product catalog size
  if (products.length >= 50) {
    signals.push({ code: 'WIDE_CATALOG', label: `Wide catalog (${products.length})`, weight: 15 });
    score += 15;
  } else if (products.length >= 10) {
    signals.push({ code: 'ACTIVE_CATALOG', label: `Active catalog (${products.length})`, weight: 8 });
    score += 8;
  } else if (products.length >= 1) {
    signals.push({ code: 'BASIC_CATALOG', label: `Basic catalog (${products.length})`, weight: 2 });
    score += 2;
  }

  // Signal: hot products (high sold count)
  const hotProducts = products.filter((p) => (p.historicalSold || 0) >= 1000);
  if (hotProducts.length >= 5) {
    signals.push({
      code: 'MULTIPLE_HOT_PRODUCTS',
      label: `${hotProducts.length} products with 1k+ sales`,
      weight: 15,
    });
    score += 15;
  } else if (hotProducts.length >= 1) {
    signals.push({
      code: 'HOT_PRODUCT',
      label: `${hotProducts.length} product(s) with 1k+ sales`,
      weight: 8,
    });
    score += 8;
  }

  // Signal: discount-driven seller (potential margin concern)
  const discounted = products.filter((p) => typeof p.discountPercentage === 'number' && p.discountPercentage >= 20);
  if (discounted.length >= 3) {
    signals.push({
      code: 'DISCOUNT_HEAVY',
      label: `Heavy discounting (${discounted.length} items)`,
      weight: -5,
    });
    score -= 5;
  }

  return { score: Math.max(0, Math.min(100, score)), signals };
}

function buildContactChannels(
  shop: Partial<NormalizedShopeeShop>,
  shopId: string | number
): LeadContactChannel[] {
  const channels: LeadContactChannel[] = [];
  if (shop.shopUrl) {
    channels.push({ type: 'shop_link', value: shop.shopUrl });
  }
  if (shop.username) {
    channels.push({ type: 'social', value: `@${shop.username}` });
  }
  channels.push({ type: 'chat', value: `shopee://chat?shop_id=${shopId}` });
  return channels;
}

function estimateMonthlyRevenue(products: NormalizedShopeeProduct[]): number | undefined {
  if (products.length === 0) return undefined;
  let total = 0;
  for (const p of products) {
    const sold = typeof p.historicalSold === 'number' ? p.historicalSold : 0;
    const price = typeof p.price === 'number' ? p.price : 0;
    // Rough estimate: assume each historical sale represents a fraction of monthly revenue
    const contribution = sold * price * 0.002;
    total += contribution;
  }
  return Math.round(total);
}

/**
 * Convert scraped shop + product data into a qualified B2B lead record.
 */
export function extractSellerLead(
  shop: Partial<NormalizedShopeeShop>,
  products: NormalizedShopeeProduct[],
  options: LeadExtractionOptions = {}
): SellerLead {
  const opts: Required<LeadExtractionOptions> = { ...DEFAULT_OPTIONS, ...options };

  const shopId = (shop.shopId ?? shop.id ?? 'unknown') as string | number;
  const shopName = shop.shopName || shop.name || 'Unknown Shop';

  const { score, signals } = extractSignals(shop, products);
  const tier = computeTier(score, opts);

  const samples = opts.includeProductSamples > 0
    ? products.slice(0, opts.includeProductSamples)
    : [];

  return {
    leadId: `lead-${deterministicId([shopId, opts.now().getTime()])}`,
    shopId,
    shopName,
    username: shop.username,
    tier,
    score,
    signals,
    productCount: products.length,
    estimatedMonthlyRevenue: estimateMonthlyRevenue(products),
    contactChannels: buildContactChannels(shop, shopId),
    extractedAt: opts.now().toISOString(),
    raw: {
      shop,
      products: samples,
    },
  };
}

/**
 * Batch extraction helper for processing multiple shops at once.
 */
export function extractSellerLeads(
  shops: Array<{ shop: Partial<NormalizedShopeeShop>; products: NormalizedShopeeProduct[] }>,
  options: LeadExtractionOptions = {}
): SellerLead[] {
  return shops
    .map(({ shop, products }) => extractSellerLead(shop, products, options))
    .sort((a, b) => b.score - a.score);
}

export default {
  extractSellerLead,
  extractSellerLeads,
};
