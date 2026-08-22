import { Env } from "../types";
import { handleHealth } from "./health";
import { handleScrapeShop } from "./scrapeShop";

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return handleHealth();
  }

  if (request.method === "POST" && (url.pathname === "/v1/scrape/shop" || url.pathname === "/scrape/shop")) {
    return handleScrapeShop(request, env);
  }

  return new Response(JSON.stringify({ error: "Not Found", path: url.pathname }), {
    status: 404,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
