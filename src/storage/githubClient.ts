import { generateDynamicSeoForPost } from '../seo';
import type {
  BlogPostRecord,
  CreateBlogPostInput,
  GitHubBlogClientOptions,
  UpdateBlogPostInput,
} from '../types';

function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64Utf8(base64: string): string {
  const clean = base64.replace(/\n/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

interface GitHubContentFile {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
  content?: string;
}

export function createGitHubBlogClient(options: GitHubBlogClientOptions) {
  const branch = options.branch ?? 'main';
  const directory = (options.directory ?? 'content/posts').replace(/^\/+|\/+$/g, '');
  const apiBase = `https://api.github.com/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}/contents`;

  const filePathForSlug = (slug: string) => {
    const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, '').replace(/\.json$/i, '');
    return `${directory}/${cleanSlug}.json`;
  };

  async function ghRequest<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`GitHub API error (${res.status}): ${errBody || res.statusText}`);
    }

    return (await res.json()) as T;
  }

  async function getFileWithSha(path: string): Promise<{ post: BlogPostRecord; sha: string } | null> {
    const url = `${apiBase}/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Failed to fetch post from GitHub (${res.status})`);
    }

    const data = (await res.json()) as GitHubContentFile;
    if (!data.content) return null;

    const jsonText = decodeBase64Utf8(data.content);
    const post = JSON.parse(jsonText) as BlogPostRecord;
    return { post, sha: data.sha };
  }

  return {
    async listPosts(): Promise<BlogPostRecord[]> {
      const url = `${apiBase}/${encodeURIComponent(directory).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${options.token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (res.status === 404) return [];
      if (!res.ok) {
        throw new Error(`Failed to list GitHub posts (${res.status})`);
      }

      const files = (await res.json()) as GitHubContentFile[];
      const jsonFiles = files.filter((f) => f.type === 'file' && f.name.endsWith('.json'));

      const posts = await Promise.all(
        jsonFiles.map(async (file) => {
          const item = await getFileWithSha(file.path);
          return item?.post ?? null;
        })
      );

      return posts.filter((p): p is BlogPostRecord => p !== null);
    },

    async getPostBySlug(slug: string): Promise<BlogPostRecord | null> {
      const record = await getFileWithSha(filePathForSlug(slug));
      return record?.post ?? null;
    },

    async createPost(input: CreateBlogPostInput): Promise<BlogPostRecord> {
      const now = new Date().toISOString();
      const generated = options.seoConfig
        ? generateDynamicSeoForPost({ ...input, createdAt: now, updatedAt: now }, options.seoConfig)
        : undefined;

      const post: BlogPostRecord = {
        ...input,
        id: input.slug,
        excerpt: input.excerpt ?? generated?.excerpt,
        coverImage: input.coverImage ?? generated?.coverImage,
        published: input.published ?? true,
        createdAt: now,
        updatedAt: now,
        seo: generated?.seo,
        schema: generated?.schema,
      };

      const path = filePathForSlug(input.slug);
      const url = `${apiBase}/${encodeURIComponent(path).replace(/%2F/g, '/')}`;

      await ghRequest(url, {
        method: 'PUT',
        body: JSON.stringify({
          message: `feat(blog): add post "${input.slug}"`,
          content: encodeBase64Utf8(JSON.stringify(post, null, 2)),
          branch,
        }),
      });

      return post;
    },

    async updatePost(slug: string, input: UpdateBlogPostInput): Promise<BlogPostRecord> {
      const path = filePathForSlug(slug);
      const existing = await getFileWithSha(path);
      if (!existing) {
        throw new Error(`Post "${slug}" not found in GitHub repository`);
      }

      const now = new Date().toISOString();
      const merged: BlogPostRecord = {
        ...existing.post,
        ...input,
        slug: input.slug ?? existing.post.slug,
        updatedAt: now,
      };

      const generated = options.seoConfig
        ? generateDynamicSeoForPost(merged, options.seoConfig)
        : undefined;

      const updated: BlogPostRecord = {
        ...merged,
        excerpt: input.excerpt ?? generated?.excerpt ?? merged.excerpt,
        coverImage: input.coverImage ?? generated?.coverImage ?? merged.coverImage,
        seo: generated?.seo ?? merged.seo,
        schema: generated?.schema ?? merged.schema,
      };

      const url = `${apiBase}/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
      await ghRequest(url, {
        method: 'PUT',
        body: JSON.stringify({
          message: `chore(blog): update post "${slug}"`,
          content: encodeBase64Utf8(JSON.stringify(updated, null, 2)),
          sha: existing.sha,
          branch,
        }),
      });

      return updated;
    },

    async deletePost(slug: string): Promise<void> {
      const path = filePathForSlug(slug);
      const existing = await getFileWithSha(path);
      if (!existing) return;

      const url = `${apiBase}/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
      await ghRequest(url, {
        method: 'DELETE',
        body: JSON.stringify({
          message: `chore(blog): delete post "${slug}"`,
          sha: existing.sha,
          branch,
        }),
      });
    },
  };
}