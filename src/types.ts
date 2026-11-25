export interface BlogSeoMetadata {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  keywords: string[];
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: 'article';
    images: string[];
    publishedTime?: string;
    modifiedTime?: string;
    tags?: string[];
  };
  twitter: {
    card: 'summary_large_image' | 'summary';
    title: string;
    description: string;
    images: string[];
  };
}

export interface BlogPostingJsonLd {
  '@context': 'https://schema.org';
  '@type': 'BlogPosting';
  headline: string;
  description: string;
  url: string;
  mainEntityOfPage: {
    '@type': 'WebPage';
    '@id': string;
  };
  image?: string[];
  datePublished?: string;
  dateModified?: string;
  author: {
    '@type': 'Person' | 'Organization';
    name: string;
    url?: string;
  };
  publisher?: {
    '@type': 'Organization';
    name: string;
    logo?: {
      '@type': 'ImageObject';
      url: string;
    };
  };
  keywords?: string;
  wordCount?: number;
}

export interface SiteSeoConfig {
  siteUrl: string; // e.g. "https://example.com"
  blogBasePath?: string; // default: "/blog"
  siteName?: string;
  defaultAuthorName?: string;
  defaultAuthorUrl?: string;
  publisherName?: string;
  publisherLogoUrl?: string;
  titleTemplate?: (postTitle: string, siteName?: string) => string;
}

export interface BlogPostMeta {
  slug: string;
  title?: string;
  updatedAt?: string | Date;
  publishedAt?: string | Date;
  changeFrequency?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
}

export interface BlogPostRecord extends BlogPostMeta {
  id?: string;
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  authorName?: string;
  tags?: string[];
  published?: boolean;
  createdAt?: string;
  seo?: BlogSeoMetadata;
  schema?: BlogPostingJsonLd;
}

export interface CreateBlogPostInput {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  authorName?: string;
  tags?: string[];
  published?: boolean;
}

export type UpdateBlogPostInput = Partial<CreateBlogPostInput>;

export interface BackendBlogClientOptions {
  baseUrl: string; // e.g. "https://api.example.com/api/posts"
  seoConfig?: SiteSeoConfig;
  headers?: Record<string, string>;
  getAuthToken?: () => string | null | Promise<string | null>;
}

export interface GitHubBlogClientOptions {
  owner: string;
  repo: string;
  token: string;
  seoConfig?: SiteSeoConfig;
  branch?: string; // default: "main"
  directory?: string; // default: "content/posts"
}

export interface SitemapOptions {
  baseUrl: string;
  blogBasePath?: string;
  includeIndexPage?: boolean;
  extraUrls?: Array<{
    loc: string;
    lastmod?: string | Date;
    changefreq?: BlogPostMeta['changeFrequency'];
    priority?: number;
  }>;
}

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface BlogEditorProps {
  value: string;
  onChange: (html: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
  placeholder?: string;
  minHeight?: number | string;
  className?: string;
}

export interface BlogRendererProps {
  html: string;
  schema?: BlogPostingJsonLd | Record<string, unknown>;
  renderSchemaScript?: boolean;
  className?: string;
  emptyFallback?: string;
}