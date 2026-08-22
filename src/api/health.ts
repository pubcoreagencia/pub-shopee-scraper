export function handleHealth(): Response {
  return new Response(JSON.stringify({ ok: true, service: "pub-shopee-scraper" }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
