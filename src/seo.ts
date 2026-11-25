import type {
  BlogPostRecord,
  BlogPostingJsonLd,
  BlogSeoMetadata,
  SiteSeoConfig,
} from './types';
import {
  countWords,
  extractFirstImageUrl,
  stripHtmlToText,
} from './utils';

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function normalizeBasePath(path?: string): string {
  if (!path) return '/blog';
  const trimmed = path.trim();
  if (!trimmed || trimmed === '/') return '';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function truncateText(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${(lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}

export function buildCanonicalPostUrl(slug: string, config: SiteSeoConfig): string {
  const origin = normalizeOrigin(config.siteUrl);
  const basePath = normalizeBasePath(config.blogBasePath);
  const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, '');
  return `${origin}${basePath}/${cleanSlug}`;
}

export function generateDynamicSeoForPost(
  post: Pick<
    BlogPostRecord,
    'slug' | 'title' | 'content' | 'excerpt' | 'coverImage' | 'authorName' | 'tags' | 'publishedAt' | 'updatedAt' | 'createdAt'
  >,
  config: SiteSeoConfig
): {
  excerpt: string;
  coverImage?: string;
  seo: BlogSeoMetadata;
  schema: BlogPostingJsonLd;
} {
  const canonicalUrl = buildCanonicalPostUrl(post.slug, config);
  const plainContent = stripHtmlToText(post.content || '');
  const autoExcerpt =
    post.excerpt?.trim() ||
    truncateText(plainContent || post.title, 158);

  const metaTitle = config.titleTemplate
    ? config.titleTemplate(post.title, config.siteName)
    : config.siteName
      ? `${post.title} | ${config.siteName}`
      : post.title;

  const metaDescription = truncateText(autoExcerpt, 160);
  const resolvedImage = post.coverImage?.trim() || extractFirstImageUrl(post.content || '');
  const images = resolvedImage ? [resolvedImage] : [];
  const keywords = Array.from(
    new Set(
      (post.tags ?? [])
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );

  const publishedTime =
    (post.publishedAt instanceof Date ? post.publishedAt.toISOString() : post.publishedAt) ||
    post.createdAt ||
    new Date().toISOString();

  const modifiedTime =
    (post.updatedAt instanceof Date ? post.updatedAt.toISOString() : post.updatedAt) ||
    publishedTime;

  const seo: BlogSeoMetadata = {
    metaTitle,
    metaDescription,
    canonicalUrl,
    keywords,
    openGraph: {
      title: post.title,
      description: metaDescription,
      url: canonicalUrl,
      type: 'article',
      images,
      publishedTime,
      modifiedTime,
      tags: keywords,
    },
    twitter: {
      card: images.length > 0 ? 'summary_large_image' : 'summary',
      title: post.title,
      description: metaDescription,
      images,
    },
  };

  const authorName = post.authorName?.trim() || config.defaultAuthorName || config.publisherName || 'Author';
  const words = countWords(post.content || '');

  const schema: BlogPostingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: metaDescription,
    url: canonicalUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    ...(images.length > 0 ? { image: images } : {}),
    datePublished: publishedTime,
    dateModified: modifiedTime,
    author: {
      '@type': config.defaultAuthorUrl ? 'Person' : 'Organization',
      name: authorName,
      ...(config.defaultAuthorUrl ? { url: config.defaultAuthorUrl } : {}),
    },
    ...(config.publisherName
      ? {
          publisher: {
            '@type': 'Organization',
            name: config.publisherName,
            ...(config.publisherLogoUrl
              ? {
                  logo: {
                    '@type': 'ImageObject',
                    url: config.publisherLogoUrl,
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(keywords.length > 0 ? { keywords: keywords.join(', ') } : {}),
    ...(words > 0 ? { wordCount: words } : {}),
  };

  return {
    excerpt: autoExcerpt,
    coverImage: resolvedImage,
    seo,
    schema,
  };
}

/**
 * Helper compatible with Next.js App Router `generateMetadata()`
 */
export function buildNextMetadataFromPost(
  post: BlogPostRecord,
  config: SiteSeoConfig
) {
  const generated = post.seo && post.schema
    ? { seo: post.seo }
    : generateDynamicSeoForPost(post, config);

  const { seo } = generated;

  return {
    title: seo.metaTitle,
    description: seo.metaDescription,
    keywords: seo.keywords,
    alternates: {
      canonical: seo.canonicalUrl,
    },
    openGraph: {
      title: seo.openGraph.title,
      description: seo.openGraph.description,
      url: seo.openGraph.url,
      type: seo.openGraph.type,
      images: seo.openGraph.images,
      publishedTime: seo.openGraph.publishedTime,
      modifiedTime: seo.openGraph.modifiedTime,
    },
    twitter: {
      card: seo.twitter.card,
      title: seo.twitter.title,
      description: seo.twitter.description,
      images: seo.twitter.images,
    },
  };
}

export function serializeJsonLd(schema: Record<string, unknown>): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}