import React, { useMemo } from 'react';
import type { BlogRendererProps } from '../types';
import { injectHeadingIds } from '../utils';
import { serializeJsonLd } from '../seo';

export const BlogRenderer: React.FC<BlogRendererProps> = ({
  html,
  schema,
  renderSchemaScript = true,
  className = '',
  emptyFallback = '',
}) => {
  const processedHtml = useMemo(() => injectHeadingIds(html), [html]);

  if (!processedHtml) {
    return emptyFallback ? <div className={className}>{emptyFallback}</div> : null;
  }

  return (
    <>
      {renderSchemaScript && schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(schema as Record<string, unknown>),
          }}
        />
      )}
      <article
        className={`cbk-renderer ${className}`}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    </>
  );
};