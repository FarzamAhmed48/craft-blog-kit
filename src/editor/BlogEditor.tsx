import React, { useEffect, useRef, useState } from 'react';
import type { BlogEditorProps } from '../types';
import { sanitizeBlogHtml } from '../utils';

export const BlogEditor: React.FC<BlogEditorProps> = ({
  value,
  onChange,
  onImageUpload,
  placeholder = 'Write your post...',
  minHeight = 280,
  className = '',
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isInternalChange = useRef(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }

    const nextHtml = value || '';
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [value]);

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    isInternalChange.current = true;
    const raw = el.innerHTML;
    const isEmpty =
      raw === '<br>' ||
      raw === '<p><br></p>' ||
      raw.replace(/<[^>]*>/g, '').trim() === '';
    onChange(isEmpty ? '' : sanitizeBlogHtml(raw));
  };

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  };

  const handleHeading = (tag: 'H2' | 'H3' | 'P') => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, `<${tag}>`);
    emitChange();
  };

  const handleLink = () => {
    const url = window.prompt('Enter URL (https://...):');
    if (!url) return;
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) {
      window.alert('Please enter a valid http(s) or relative URL.');
      return;
    }
    exec('createLink', trimmed);
  };

  const handleInsertImage = async () => {
    if (onImageUpload && fileInputRef.current) {
      fileInputRef.current.click();
      return;
    }
    const imageUrl = window.prompt('Enter image URL (https://...):');
    if (!imageUrl) return;
    exec('insertImage', imageUrl.trim());
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onImageUpload) return;

    try {
      setUploading(true);
      const uploadedUrl = await onImageUpload(file);
      if (uploadedUrl) {
        exec('insertImage', uploadedUrl);
      }
    } finally {
      setUploading(false);
    }
  };

  const isEmptyValue = !value || value.replace(/<[^>]*>/g, '').trim() === '';

  const btnStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#111827',
    cursor: 'pointer',
    lineHeight: 1.4,
  };

  return (
    <div
      className={`cbk-editor ${className}`}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      <div
        role="toolbar"
        aria-label="Formatting toolbar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '8px 10px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
        }}
      >
        <button type="button" style={btnStyle} onClick={() => exec('bold')}>
          <strong>B</strong>
        </button>
        <button type="button" style={btnStyle} onClick={() => exec('italic')}>
          <em>I</em>
        </button>
        <button type="button" style={btnStyle} onClick={() => exec('underline')}>
          <span style={{ textDecoration: 'underline' }}>U</span>
        </button>
        <button type="button" style={btnStyle} onClick={() => exec('strikeThrough')}>
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </button>
        <button type="button" style={btnStyle} onClick={() => handleHeading('H2')}>
          H2
        </button>
        <button type="button" style={btnStyle} onClick={() => handleHeading('H3')}>
          H3
        </button>
        <button type="button" style={btnStyle} onClick={() => handleHeading('P')}>
          P
        </button>
        <button type="button" style={btnStyle} onClick={() => exec('insertUnorderedList')}>
          • List
        </button>
        <button type="button" style={btnStyle} onClick={() => exec('insertOrderedList')}>
          1. List
        </button>
        <button type="button" style={btnStyle} onClick={() => exec('formatBlock', 'BLOCKQUOTE')}>
          Quote
        </button>
        <button type="button" style={btnStyle} onClick={() => exec('formatBlock', 'PRE')}>
          Code
        </button>
        <button type="button" style={btnStyle} onClick={handleLink}>
          Link
        </button>
        <button type="button" style={btnStyle} onClick={handleInsertImage} disabled={uploading}>
          {uploading ? 'Uploading...' : 'Image'}
        </button>
        <button type="button" style={btnStyle} onClick={() => exec('undo')}>
          Undo
        </button>
        <button type="button" style={btnStyle} onClick={() => exec('redo')}>
          Redo
        </button>
      </div>

      {onImageUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      )}

      <div style={{ position: 'relative' }}>
        {isEmptyValue && (
          <div
            style={{
              position: 'absolute',
              top: '14px',
              left: '16px',
              color: '#9ca3af',
              fontSize: '15px',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          style={{
            minHeight,
            padding: '14px 16px',
            outline: 'none',
            fontSize: '15px',
            lineHeight: 1.7,
            color: '#111827',
          }}
        />
      </div>
    </div>
  );
};