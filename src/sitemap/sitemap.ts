import type { BlogPostMeta, SitemapOptions } from '../types';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatW3CDate(input?: string | Date): string | null {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function normalizePath(path?: string): string {
  if (!path) return '';
  const trimmed = path.trim();
  if (!trimmed || trimmed === '/') return '';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

export function buildPostUrl(
  slug: string,
  baseUrl: string,
  blogBasePath = '/blog'
): string {
  const origin = normalizeBaseUrl(baseUrl);
  const prefix = normalizePath(blogBasePath);
  const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, '');
  return `${origin}${prefix}/${cleanSlug}`;
}

export function generateBlogSitemapXml(
  posts: BlogPostMeta[],
  options: SitemapOptions
): string {
  const origin = normalizeBaseUrl(options.baseUrl);
  const prefix = normalizePath(options.blogBasePath ?? '/blog');
  const includeIndex = options.includeIndexPage ?? true;

  const entries: Array<{
    loc: string;
    lastmod?: string | null;
    changefreq?: string;
    priority?: number;
  }> = [];

  if (includeIndex) {
    entries.push({
      loc: `${origin}${prefix || '/'}`,
      changefreq: 'daily',
      priority: 0.8,
    });
  }

  for (const post of posts) {
    if (!post.slug?.trim()) continue;
    entries.push({
      loc: buildPostUrl(post.slug, origin, prefix),
      lastmod: formatW3CDate(post.updatedAt ?? post.publishedAt),
      changefreq: post.changeFrequency ?? 'weekly',
      priority: post.priority ?? 0.7,
    });
  }

  for (const extra of options.extraUrls ?? []) {
    if (!extra.loc?.trim()) continue;
    const loc = /^https?:\/\//i.test(extra.loc)
      ? extra.loc.trim()
      : `${origin}${normalizePath(extra.loc) || '/'}`;
    entries.push({
      loc,
      lastmod: formatW3CDate(extra.lastmod),
      changefreq: extra.changefreq,
      priority: extra.priority,
    });
  }

  const urlNodes = entries
    .map((item) => {
      const parts = [`    <loc>${escapeXml(item.loc)}</loc>`];
      if (item.lastmod) {
        parts.push(`    <lastmod>${escapeXml(item.lastmod)}</lastmod>`);
      }
      if (item.changefreq) {
        parts.push(`    <changefreq>${escapeXml(item.changefreq)}</changefreq>`);
      }
      if (typeof item.priority === 'number') {
        parts.push(`    <priority>${item.priority.toFixed(1)}</priority>`);
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlNodes,
    '</urlset>',
  ].join('\n');
}

export function createSitemapXmlResponse(
  posts: BlogPostMeta[],
  options: SitemapOptions,
  cacheMaxAgeSeconds = 3600
): Response {
  const xml = generateBlogSitemapXml(posts, options);
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${cacheMaxAgeSeconds}, s-maxage=${cacheMaxAgeSeconds}`,
    },
  });
}

export async function pingSearchEnginesForSitemap(sitemapUrl: string) {
  const encoded = encodeURIComponent(sitemapUrl);
  const endpoints = [
    `https://www.google.com/ping?sitemap=${encoded}`,
    `https://www.bing.com/ping?sitemap=${encoded}`,
  ];

  return Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        const res = await fetch(endpoint);
        return { endpoint, ok: res.ok, status: res.status };
      } catch (err) {
        return {
          endpoint,
          ok: false,
          error: err instanceof Error ? err.message : 'Ping failed',
        };
      }
    })
  );
}