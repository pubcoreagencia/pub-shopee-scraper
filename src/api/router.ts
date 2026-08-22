import { Env } from "../types";
import { handleHealth } from "./health";
import { handleScrapeShop } from "./scrapeShop";

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const requestId = crypto.randomUUID();

  if (request.method === "GET" && url.pathname === "/health") {
    return handleHealth(requestId);
  }

  if (request.method === "POST" && (url.pathname === "/v1/scrape/shop" || url.pathname === "/scrape/shop")) {
    return handleScrapeShop(request, env, requestId);
  }

  return new Response(JSON.stringify({ error: "Not Found", path: url.pathname, requestId }), {
    status: 404,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}
