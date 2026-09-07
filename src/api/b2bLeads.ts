import { Router, Request, Response } from 'express';
import { rateLimiter } from './rateLimiter';
import { ShopeeProviderRouter } from '../providers/ShopeeProviderRouter';
import { LeadExtractor } from '../normalizers/leadExtractor';
import { B2BLeadEnricher } from '../normalizers/b2bLeadEnricher';
import { logger } from '../utils/logger';

export interface B2BLeadsQuery {
  shops: string | string[];
  segment?: string;
  minScore?: number;
  exportFormat?: 'json' | 'csv';
}

export interface EnrichedLead {
  shopId: string;
  shopName: string;
  sellerEmail: string | null;
  whatsapp: string | null;
  phone: string | null;
  shopLocation: string | null;
  productCount: number;
  estimatedMonthlySales: number;
  ratingScore: number;
  leadScore: number;
  b2BSegment: string;
  recommendedOutreach: string;
  capturedAt: string;
  source: 'apify' | 'browser';
}

export class B2BLeadsService {
  private readonly provider: ShopeeProviderRouter;
  private readonly enricher: B2BLeadEnricher;

  constructor(provider?: ShopeeProviderRouter) {
    this.provider = provider || new ShopeeProviderRouter();
    this.enricher = new B2BLeadEnricher();
  }

  async collectLeads(query: B2BLeadsQuery): Promise<EnrichedLead[]> {
    const shopIds = Array.isArray(query.shops)
      ? query.shops
      : query.shops.split(',').map((s) => s.trim()).filter(Boolean);

    if (shopIds.length === 0) {
      throw new Error('At least one shopId must be provided');
    }
    if (shopIds.length > 50) {
      throw new Error('Batch limit is 50 shops per request');
    }

    const settled = await Promise.allSettled(
      shopIds.map((id) => this.provider.fetchShop(id))
    );

    const leads: EnrichedLead[] = [];
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === 'rejected') {
        logger.warn('Shop fetch failed', {
          shopId: shopIds[i],
          reason: String(result.reason),
        });
        continue;
      }
      const shop = result.value;
      const extracted = LeadExtractor.extract(shop);
      const enriched = this.enricher.enrich(extracted, {
        segment: query.segment,
        source: shop.provider,
      });
      if (query.minScore && enriched.leadScore < query.minScore) continue;
      leads.push(enriched);
    }

    return leads.sort((a, b) => b.leadScore - a.leadScore);
  }

  toCsv(leads: EnrichedLead[]): string {
    const headers = [
      'shopId',
      'shopName',
      'sellerEmail',
      'whatsapp',
      'phone',
      'shopLocation',
      'productCount',
      'estimatedMonthlySales',
      'ratingScore',
      'leadScore',
      'b2BSegment',
      'recommendedOutreach',
      'capturedAt',
      'source',
    ];
    const escape = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (/[",\n;]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const rows = leads.map((lead) =>
      headers.map((h) => escape(lead[h as keyof EnrichedLead])).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }
}

export const buildB2BLeadsRouter = (service?: B2BLeadsService): Router => {
  const router = Router();
  const svc = service || new B2BLeadsService();

  router.get(
    '/b2b-leads',
    rateLimiter({ windowMs: 60_000, max: 20 }),
    async (req: Request, res: Response) => {
      try {
        const { shops, segment, minScore, exportFormat } = req.query;
        if (!shops || typeof shops !== 'string') {
          return res.status(400).json({
            error: 'Query param "shops" is required (comma-separated shopIds)',
          });
        }
        const parsedMin = minScore ? Number(minScore) : undefined;
        const leads = await svc.collectLeads({
          shops,
          segment: typeof segment === 'string' ? segment : undefined,
          minScore:
            parsedMin !== undefined && Number.isFinite(parsedMin)
              ? parsedMin
              : undefined,
          exportFormat:
            exportFormat === 'csv' || exportFormat === 'json'
              ? exportFormat
              : 'json',
        });
        if ((req.query.exportFormat as string) === 'csv') {
          const csv = svc.toCsv(leads);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="b2b-leads-${Date.now()}.csv"`
          );
          return res.status(200).send(csv);
        }
        return res.status(200).json({
          count: leads.length,
          generatedAt: new Date().toISOString(),
          leads,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('B2B leads collection failed', { error: message });
        return res.status(500).json({ error: message });
      }
    }
  );

  router.post(
    '/b2b-leads/batch',
    rateLimiter({ windowMs: 60_000, max: 10 }),
    async (req: Request, res: Response) => {
      try {
        const body = req.body as B2BLeadsQuery;
        if (!body || !body.shops) {
          return res
            .status(400)
            .json({ error: 'Body field "shops" is required' });
        }
        const leads = await svc.collectLeads(body);
        return res.status(200).json({
          count: leads.length,
          generatedAt: new Date().toISOString(),
          leads,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return res.status(400).json({ error: message });
      }
    }
  );

  return router;
};
