# Security & Secret Management — PUB Shopee Scraper

## 1. Secrets Existentes

| Secret | Descrição | Onde é Armazenado | Escopo de Uso |
| :--- | :--- | :--- | :--- |
| `APIFY_TOKEN` | Token de API oficial da Apify para execução do Actor `xtracto~shopee-shop-scraper` | Cloudflare Worker Secret (criptografado) | Comunicação segura com a API da Apify |
| `SHOPEE_SCRAPER_TOKEN` | Bearer Token para autenticação de clientes no endpoint `/v1/scrape/shop` | Cloudflare Worker Secret (criptografado) | Proteção do endpoint público contra acesso não autorizado |
| `CATALOG_WORKER_TOKEN` | Token legado de interoperabilidade com workers da holding | Cloudflare Worker Secret (criptografado) | Compatibilidade com callers existentes |

---

## 2. Regras Estritas de Segurança

1. **Nunca versionar secrets no Git:** Arquivos `.env`, `.dev.vars`, tokens e chaves são explicitamente ignorados pelo `.gitignore`.
2. **Sem vazamento em logs ou respostas de erro:** Erros de rede, timeouts ou falhas de autenticação de providers são sanitizados antes de serem devolvidos ao cliente, omitindo URLs internas, tokens e headers de autorização.
3. **Execução de testes sem credenciais:** A suíte de testes unitários (`npm test`) utiliza mocks e fixtures locais, sem dependência de tokens reais ou chamadas a APIs externas.

---

## 3. Procedimento de Rotação de Secrets

Quando for necessário rotacionar uma credencial (ex: rotação do `APIFY_TOKEN`):

1. **Obter a nova credencial** no console oficial do provedor (ex: Apify Console).
2. **Atualizar o segredo no Cloudflare Workers** utilizando o Wrangler:
   ```bash
   # No ambiente autenticado do operador:
   "<novo_token>" | npx wrangler secret put APIFY_TOKEN
   ```
3. **Validar o funcionamento em produção** executando o script de teste ao vivo com o token na sessão do terminal:
   ```bash
   $env:SHOPEE_SCRAPER_TOKEN = "<token_de_acesso>"
   node tests/live_test.cjs
   ```
4. **Revogar o token anterior** no console do provedor.
