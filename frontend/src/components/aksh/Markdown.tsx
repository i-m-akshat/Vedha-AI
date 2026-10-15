import React, { useMemo } from 'react';

/**
 * Robust, XSS-safe Markdown renderer for Aksh AI chat responses.
 * Handles:
 * - Headings (#, ##, ###)
 * - Bold (**text**, __text__) and Italic (*text*, _text_)
 * - Inline code (`code`) and Multiline code blocks (```lang\ncode\n```)
 * - Standard Unordered Lists (-, *, •, –, —, ▪, ▫, ◦, +)
 * - Ordered Lists (1., 2., 1), 2))
 * - Smart Clause/List Detection (e.g. options after a colon ending with commas)
 * - Blockquotes (> quote)
 * - Horizontal Rules (---, ***)
 * - Full Light/Dark mode contrast compliance (no hardcoded #fff on light mode)
 */

const SENTINEL_OPEN = '⟦CODE_';
const SENTINEL_CLOSE = '_CODE⟧';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(escaped: string): string {
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

  let inList: 'ul' | 'ol' | false = false;
  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  let awaitingClauseList = false;

  const closeList = () => {
    if (inList === 'ul') {
      html.push('</ul>');
      inList = false;
    } else if (inList === 'ol') {
      html.push('</ol>');
      inList = false;
    }
  };

  const closeCodeBlock = () => {
    if (inCodeBlock) {
      html.push(`<pre class="aksh-md-pre"><code>${codeBlockBuffer.join('\n')}</code></pre>`);
      codeBlockBuffer = [];
      inCodeBlock = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Multiline code block fence
    if (trimmed.startsWith('```')) {
      closeList();
      awaitingClauseList = false;
      if (inCodeBlock) {
        closeCodeBlock();
      } else {
        inCodeBlock = true;
        codeBlockBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(rawLine);
      continue;
    }

    // Blank line
    if (trimmed === '') {
      closeList();
      continue;
    }

    // Horizontal Rule
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList();
      awaitingClauseList = false;
      html.push('<hr class="aksh-md-hr" />');
      continue;
    }

    // Blockquote
    const quoteMatch = trimmed.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      closeList();
      awaitingClauseList = false;
      html.push(`<blockquote class="aksh-md-quote">${renderInline(quoteMatch[1])}</blockquote>`);
      continue;
    }

    // Heading (#, ##, ###)
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      awaitingClauseList = false;
      const level = heading[1].length;
      html.push(`<div class="aksh-md-h${level}">${renderInline(heading[2])}</div>`);
      continue;
    }

    // Standard Bullet / Ordered List Item
    // Matches: -, *, •, –, —, ▪, ▫, ◦, + OR numbers 1., 2), (1)
    const bulletMatch = trimmed.match(/^([-*•–—▪▫◦+]|\d+[.)]|\(\d+\))\s+(.*)$/);
    if (bulletMatch) {
      const marker = bulletMatch[1];
      const content = bulletMatch[2];
      const isOrdered = /^\d+[.)]|\(\d+\)$/.test(marker);
      const targetListType: 'ul' | 'ol' = isOrdered ? 'ol' : 'ul';

      if (inList !== targetListType) {
        closeList();
        inList = targetListType;
        html.push(isOrdered ? '<ol class="aksh-md-ordered">' : '<ul class="aksh-md-list">');
      }

      awaitingClauseList = false;
      html.push(`<li>${renderInline(content)}</li>`);
      continue;
    }

    // Smart Clause Detection:
    // If previous line was an intro ending with ':' (e.g. "Whether you're looking to:")
    // and this line ends with a comma, semicolon, or "or" / "and", treat as a bullet item!
    const isClauseLine =
      (awaitingClauseList || inList === 'ul') &&
      (/[,;]\s*(or|and)?$/i.test(trimmed) || (awaitingClauseList && i + 1 < lines.length && /[,;]/i.test(lines[i + 1])));

    if (isClauseLine) {
      if (inList !== 'ul') {
        closeList();
        inList = 'ul';
        html.push('<ul class="aksh-md-list">');
      }
      const cleanClause = trimmed.replace(/([,;]\s*(or|and)?|\s*or|\s*and)$/i, '');
      html.push(`<li>${renderInline(cleanClause)}</li>`);
      awaitingClauseList = true;
      continue;
    }

    // If line ends with a colon, flag that following lines might be enumerated clauses
    if (trimmed.endsWith(':')) {
      closeList();
      awaitingClauseList = true;
      html.push(`<p class="font-medium">${renderInline(trimmed)}</p>`);
      continue;
    }

    // Regular paragraph
    closeList();
    awaitingClauseList = false;
    html.push(`<p>${renderInline(trimmed)}</p>`);
  }

  closeList();
  closeCodeBlock();
  return html.join('');
}

export const Markdown: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const html = useMemo(() => renderBlocks(escapeHtml(text)), [text]);

  return (
    <>
      <style>{`
        .aksh-md {
          line-height: 1.65;
          word-break: break-word;
        }
        .aksh-md p {
          margin: 0 0 0.65rem 0;
        }
        .aksh-md p:last-child {
          margin-bottom: 0;
        }
        .aksh-md strong {
          color: inherit;
          font-weight: 700;
        }
        .aksh-md em {
          color: inherit;
          font-style: italic;
        }
        .aksh-md-code {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.85em;
          background: rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 5px;
          padding: 1px 6px;
          color: #D9704F;
        }
        .dark .aksh-md-code {
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #EFA84B;
        }
        .aksh-md-pre {
          margin: 0.65rem 0;
          padding: 0.75rem 1rem;
          background: rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 0.75rem;
          overflow-x: auto;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.85em;
          line-height: 1.55;
        }
        .dark .aksh-md-pre {
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .aksh-md-h1 {
          font-weight: 800;
          font-size: 1.15em;
          margin: 0.85rem 0 0.4rem 0;
          color: inherit;
          letter-spacing: -0.01em;
        }
        .aksh-md-h2 {
          font-weight: 700;
          font-size: 1.05em;
          margin: 0.75rem 0 0.35rem 0;
          color: inherit;
          letter-spacing: -0.01em;
        }
        .aksh-md-h3, .aksh-md-h4 {
          font-weight: 700;
          font-size: 0.95em;
          margin: 0.65rem 0 0.3rem 0;
          color: inherit;
        }
        .aksh-md ul.aksh-md-list {
          margin: 0.5rem 0 0.75rem 0;
          padding-left: 1.35rem;
          list-style-type: disc;
        }
        .aksh-md ol.aksh-md-ordered {
          margin: 0.5rem 0 0.75rem 0;
          padding-left: 1.35rem;
          list-style-type: decimal;
        }
        .aksh-md li {
          margin-bottom: 0.4rem;
          padding-left: 0.25rem;
          line-height: 1.6;
        }
        .aksh-md li:last-child {
          margin-bottom: 0;
        }
        .aksh-md-quote {
          border-left: 3px solid #D9704F;
          padding-left: 0.85rem;
          margin: 0.65rem 0;
          opacity: 0.88;
          font-style: italic;
        }
        .aksh-md-hr {
          border: 0;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
          margin: 1rem 0;
        }
        .dark .aksh-md-hr {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
      `}</style>
      <div className={`aksh-md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
};
