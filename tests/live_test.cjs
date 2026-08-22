async function testNewProduct() {
  const baseUrl = "https://pub-shopee-scraper.contato-pubcore.workers.dev";
  const token = "pub_shopee_scraper_token_2026";

  console.log("=== 1. TEST GET /health ===");
  const healthRes = await fetch(`${baseUrl}/health`);
  console.log(`Health Status: ${healthRes.status}`);
  const healthData = await healthRes.json();
  console.log("Health Data:", JSON.stringify(healthData));

  console.log("\n=== 2. TEST POST /v1/scrape/shop (limit: 3) ===");
  const start = Date.now();
  const scrapeRes = await fetch(`${baseUrl}/v1/scrape/shop`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      shopUrl: "https://shopee.com.br/9r18ht6m88",
      limit: 3,
    }),
  });

  const duration = Date.now() - start;
  console.log(`Scrape Status: ${scrapeRes.status} (${duration}ms)`);
  const scrapeData = await scrapeRes.json();
  console.log("Scrape Data:", JSON.stringify(scrapeData, null, 2));
}

testNewProduct().catch(console.error);
