import { Env } from "./types";
import { handleRequest } from "./api/router";

export * from "./types";
export * from "./normalizers/shopeeProductNormalizer";
export * from "./providers/IShopeeProvider";
export * from "./providers/ShopeeProviderRouter";
export * from "./providers/apify/ApifyShopeeProvider";
export * from "./providers/browser/CloudflareShopeeProvider";
export * from "./api/validation";
export * from "./api/rateLimiter";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
