import { Env, ShopeeScrapeRequest } from "../types";
import { ShopeeProviderRouter } from "../providers/ShopeeProviderRouter";

function isAuthorized(request: Request, env: Env): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const validTokens = [env.SHOPEE_SCRAPER_TOKEN, env.CATALOG_WORKER_TOKEN].filter(Boolean);
  if (validTokens.length === 0) return true;
  return validTokens.some((t) => auth === `Bearer ${t}`);
}

export async function handleScrapeShop(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  let body: ShopeeScrapeRequest;
  try {
    body = (await request.json()) as ShopeeScrapeRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  if (!body.shopUrl && !body.shopUsername && !body.shopId) {
    return new Response(
      JSON.stringify({
        error: "Missing required identifier: shopUrl, shopUsername, or shopId is required",
      }),
      { status: 400, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const router = new ShopeeProviderRouter(env);
  const result = await router.scrape(body);

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 502,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
