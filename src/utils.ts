import type { TocItem } from './types';

export function slugifyText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function stripHtmlToText(htmlOrText: string): string {
  return htmlOrText
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(htmlOrText: string): number {
  const plain = stripHtmlToText(htmlOrText);
  if (!plain) return 0;
  return plain.split(' ').filter(Boolean).length;
}

export function calculateReadingTime(htmlOrText: string, wordsPerMinute = 200): number {
  const words = countWords(htmlOrText);
  if (!words) return 1;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function extractTableOfContents(html: string): TocItem[] {
  if (!html) return [];
  const headingRegex = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const items: TocItem[] = [];
  const seen = new Map<string, number>();

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = Number(match[1]) as 2 | 3;
    const rawText = stripHtmlToText(match[2]);
    if (!rawText) continue;

    const baseId = slugifyText(rawText) || 'section';
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;

    items.push({ id, text: rawText, level });
  }

  return items;
}

export function sanitizeBlogHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return '';

  let clean = dirtyHtml
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '');

  clean = clean.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  clean = clean.replace(
    /(href|src)\s*=\s*(["'])\s*(?:javascript:|data:text\/html)[^"']*\2/gi,
    '$1=$2#$2'
  );

  return clean.trim();
}

export function injectHeadingIds(html: string): string {
  const sanitized = sanitizeBlogHtml(html);
  const seen = new Map<string, number>();

  return sanitized.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_full, level, attrs, inner) => {
    const text = stripHtmlToText(String(inner));
    const baseId = slugifyText(text) || 'section';
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;

    const cleanedAttrs = String(attrs).replace(/\s*id\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
    return `<h${level}${cleanedAttrs} id="${id}">${inner}</h${level}>`;
  });
}

export function extractFirstImageUrl(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1]?.trim() || undefined;
}