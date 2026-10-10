import React, { useMemo } from 'react';

/**
 * Minimal, XSS-safe Markdown renderer for agent chat output.
 * LLM text is untrusted: HTML is escaped FIRST, then a small subset of
 * Markdown (headings, bold, italic, inline code, lists, paragraphs) is applied.
 * No new dependencies, no dangerouslySetInnerHTML with unsanitized input.
 */

// ASCII-only sentinels guard code spans while inline rules run.
const SENTINEL_OPEN = '[CODE';
const SENTINEL_CLOSE = 'CODE]';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(escaped: string): string {
  // Code spans first (protected from inner formatting).
  const codeSpans: string[] = [];
  let out = escaped.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    codeSpans.push(code);
    return `${SENTINEL_OPEN}${codeSpans.length - 1}${SENTINEL_CLOSE}`;
  });
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');
  const sentinel = new RegExp(
    SENTINEL_OPEN.replace(/[[\]]/g, '\\$&') +
      '(\\d+)' +
      SENTINEL_CLOSE.replace(/[[\]]/g, '\\$&'),
    'g',
  );
  out = out.replace(sentinel, (_m, i: string) => {
    const code = codeSpans[Number(i)] ?? '';
    return `<code class="aksh-md-code">${code}</code>`;
  });
  return out;
}

function renderBlocks(escaped: string): string {
  const lines = escaped.split('\n');
  const html: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed === '') {
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<div class="aksh-md-h${level}">${renderInline(heading[2])}</div>`);
      continue;
    }

    const bullet = trimmed.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        html.push('<ul class="aksh-md-list">');
        inList = true;
      }
      html.push(`<li>${renderInline(bullet[2])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInline(trimmed)}</p>`);
  }
  closeList();
  return html.join('');
}

export const Markdown: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const html = useMemo(() => renderBlocks(escapeHtml(text)), [text]);
  return (
    <>
      <style>{`
        .aksh-md p { margin: 0 0 6px 0; }
        .aksh-md p:last-child { margin-bottom: 0; }
        .aksh-md strong { color: #fff; font-weight: 700; }
        .aksh-md em { color: #c9ccd4; }
        .aksh-md-code {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.85em;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 5px;
          padding: 1px 5px;
        }
        .aksh-md-h1 { color: #fff; font-weight: 800; font-size: 1.02em; margin: 2px 0 6px 0; }
        .aksh-md-h2, .aksh-md-h3 { color: #fff; font-weight: 700; font-size: 0.95em; margin: 2px 0 5px 0; }
        .aksh-md-list { margin: 2px 0 6px 0; padding-left: 18px; list-style: disc; display: flex; flex-direction: column; gap: 3px; }
      `}</style>
      <div className={`aksh-md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
};
