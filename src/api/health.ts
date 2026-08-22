export function handleHealth(requestId: string): Response {
  return new Response(JSON.stringify({ ok: true, service: "pub-shopee-scraper", requestId }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}
