'use client';

import { useState } from 'react';

interface ShareBarProps {
  shareText: string;
  shareUrl: string;
  label?: string;
}

export function ShareBar({ shareText, shareUrl, label }: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  function fallbackCopy() {
    const ta = document.createElement('textarea');
    ta.value = shareText;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* silent */ }
    document.body.removeChild(ta);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  function handleCopy() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareText)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        })
        .catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  const xHref = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  const tgHref = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && (
        <span className="mr-1 text-[11px] uppercase tracking-[0.20em] text-crt/28">{label} ›</span>
      )}
      <button
        onClick={handleCopy}
        className="share-btn"
        title="Copy share text to clipboard"
      >
        {copied ? '✓ copied' : '[ copy ]'}
      </button>
      <a
        href={xHref}
        target="_blank"
        rel="noopener noreferrer"
        className="share-btn"
        title="Share on X"
      >
        [ x.com ]
      </a>
      <a
        href={tgHref}
        target="_blank"
        rel="noopener noreferrer"
        className="share-btn"
        title="Share on Telegram"
      >
        [ telegram ]
      </a>
    </div>
  );
}
