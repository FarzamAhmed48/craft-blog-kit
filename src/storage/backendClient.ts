import { generateDynamicSeoForPost } from '../seo';
import type {
  BackendBlogClientOptions,
  BlogPostRecord,
  CreateBlogPostInput,
  UpdateBlogPostInput,
} from '../types';

export function createBackendBlogClient(options: BackendBlogClientOptions) {
  const baseUrl = options.baseUrl.trim().replace(/\/+$/, '');

  async function buildHeaders(): Promise<Record<string, string>> {
    const token = options.getAuthToken ? await options.getAuthToken() : null;
    return {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = await buildHeaders();
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers ?? {}),
      },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) ||
        `Backend blog request failed with status ${res.status}`;
      throw new Error(msg);
    }

    return (data?.data ?? data) as T;
  }

  function enrichPost(post: BlogPostRecord): BlogPostRecord {
    if (!options.seoConfig) return post;
    const generated = generateDynamicSeoForPost(post, options.seoConfig);
    return {
      ...post,
      excerpt: post.excerpt ?? generated.excerpt,
      coverImage: post.coverImage ?? generated.coverImage,
      seo: post.seo ?? generated.seo,
      schema: post.schema ?? generated.schema,
    };
  }

  return {
    async listPosts(query?: { published?: boolean; tag?: string }): Promise<BlogPostRecord[]> {
      const params = new URLSearchParams();
      if (typeof query?.published === 'boolean') {
        params.set('published', String(query.published));
      }
      if (query?.tag) {
        params.set('tag', query.tag);
      }
      const qs = params.toString();
      const rows = await request<BlogPostRecord[]>(qs ? `?${qs}` : '');
      return rows.map(enrichPost);
    },

    async getPostBySlug(slug: string): Promise<BlogPostRecord> {
      const row = await request<BlogPostRecord>(`/${encodeURIComponent(slug)}`);
      return enrichPost(row);
    },

    async createPost(input: CreateBlogPostInput): Promise<BlogPostRecord> {
      const now = new Date().toISOString();
      const generated = options.seoConfig
        ? generateDynamicSeoForPost({ ...input, createdAt: now, updatedAt: now }, options.seoConfig)
        : undefined;

      const payload = {
        ...input,
        excerpt: input.excerpt ?? generated?.excerpt,
        coverImage: input.coverImage ?? generated?.coverImage,
        seo: generated?.seo,
        schema: generated?.schema,
      };

      const created = await request<BlogPostRecord>('', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return enrichPost(created);
    },

    async updatePost(slugOrId: string, input: UpdateBlogPostInput): Promise<BlogPostRecord> {
      let generated: ReturnType<typeof generateDynamicSeoForPost> | undefined;
      if (options.seoConfig && input.title && input.content) {
        generated = generateDynamicSeoForPost(
          {
            slug: input.slug ?? slugOrId,
            title: input.title,
            content: input.content,
            excerpt: input.excerpt,
            coverImage: input.coverImage,
            authorName: input.authorName,
            tags: input.tags,
            updatedAt: new Date().toISOString(),
          },
          options.seoConfig
        );
      }

      const payload = {
        ...input,
        ...(generated
          ? {
              excerpt: input.excerpt ?? generated.excerpt,
              coverImage: input.coverImage ?? generated.coverImage,
              seo: generated.seo,
              schema: generated.schema,
            }
          : {}),
      };

      const updated = await request<BlogPostRecord>(`/${encodeURIComponent(slugOrId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      return enrichPost(updated);
    },

    deletePost(slugOrId: string) {
      return request<{ deleted: boolean }>(`/${encodeURIComponent(slugOrId)}`, {
        method: 'DELETE',
      });
    },
  };
}