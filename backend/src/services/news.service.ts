import { Series } from '@prisma/client';
import { prisma, safeQuery } from '../config/prisma';
import { REFERENCE_NEWS, referenceIds } from '../config/referenceData';

export interface NewsDto {
  id: string;
  title: string;
  summary: string;
  series: Series;
  sourceUrl: string;
  imageUrl: string | null;
  publishedAt: string;
}

export interface NewsResult {
  count: number;
  items: NewsDto[];
  degraded: boolean;
  generatedAt: string;
}

export async function getNews(series: Series | undefined, limit = 20): Promise<NewsResult> {
  const { data, degraded } = await safeQuery(
    'news.list',
    () =>
      prisma.newsItem.findMany({
        where: series ? { series } : undefined,
        orderBy: { publishedAt: 'desc' },
        take: limit,
      }),
    () =>
      REFERENCE_NEWS.filter((item) => (series ? item.series === series : true))
        .sort((a, b) => a.publishedOffsetMinutes - b.publishedOffsetMinutes)
        .slice(0, limit)
        .map((item) => ({
          id: referenceIds.news(item.key),
          title: item.title,
          summary: item.summary,
          series: item.series,
          sourceUrl: item.sourceUrl,
          imageUrl: item.imageUrl,
          publishedAt: new Date(Date.now() + item.publishedOffsetMinutes * 60_000),
        })),
  );

  return {
    count: data.length,
    items: data.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      series: item.series,
      sourceUrl: item.sourceUrl,
      imageUrl: item.imageUrl ?? null,
      publishedAt: item.publishedAt.toISOString(),
    })),
    degraded,
    generatedAt: new Date().toISOString(),
  };
}
