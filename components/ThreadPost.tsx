'use client';

import { useState } from 'react';
import type { ReactionSet, Reply, ThreadContent } from '@/lib/forum-types';
import { addReactionAction } from '@/app/actions';
import { getFingerprint } from '@/lib/identity';
import { ReportModal } from '@/components/ReportModal';

type Post = ThreadContent | Reply;

interface ThreadPostProps {
  post: Post;
  postNumber: number;
  isOP?: boolean;
}

const REACTION_DEFS: Array<{ key: keyof ReactionSet; glyph: string; label: string }> = [
  { key: 'echo',    glyph: '~', label: 'ECHO'     },
  { key: 'witness', glyph: '+', label: 'WITNESSED' },
  { key: 'signal',  glyph: '▸', label: 'SIGNAL'   },
  { key: 'ripple',  glyph: '◻', label: 'ARCHIVED'  },
  { key: 'dive',    glyph: '↯', label: 'GLITCH'   },
];

function renderBody(body: string) {
  return body.split('\n').map((line, i) => {
    if (line.startsWith('> ') || line === '>') {
      return (
        <div key={i} className="greentext-line">
          {line.startsWith('> ') ? line.slice(2) : ''}
        </div>
      );
    }
    if (line === '') return <div key={i} className="h-3" />;
    return (
      <div key={i} className="post-body-line">
        {line}
      </div>
    );
  });
}

function getAuthorMode(post: Post): 'anon' | 'ghost' {
  if ('authorMode' in post) return post.authorMode;
  return 'ghost';
}

/**
 * Resolve the DB UUID for the reaction target.
 *
 * ThreadContent:  id = slug (for routing), authorId = real UUID
 * Reply:          id = UUID directly from DB
 *
 * In mock mode the IDs are fake strings; addReactionAction returns {ok:true}
 * immediately without using them, so the mismatch is harmless.
 */
function resolveTargetId(post: Post, isOP: boolean): string {
  if (isOP) {
    const thread = post as ThreadContent;
    return thread.authorId ?? thread.id;
  }
  return post.id;
}

export function ThreadPost({ post, postNumber, isOP = false }: ThreadPostProps) {
  const [reacted, setReacted] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<ReactionSet>({ ...post.reactions });
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  function toggleReaction(key: keyof ReactionSet) {
    const wasReacted = reacted[key];

    // Optimistic update — UI responds immediately
    setReacted((prev) => ({ ...prev, [key]: !wasReacted }));
    setCounts((prev) => ({
      ...prev,
      [key]: wasReacted ? Math.max(0, prev[key] - 1) : prev[key] + 1,
    }));

    // Persist the addition (not removal — schema has no delete for reactions)
    if (!wasReacted) {
      const targetType = isOP ? 'thread' : 'reply';
      const targetId   = resolveTargetId(post, isOP);

      addReactionAction({
        targetType,
        targetId,
        reactionType:    key,
        anonFingerprint: getFingerprint(),
      }).then((result) => {
        if ('error' in result) {
          // Revert the optimistic update and surface the error
          setReacted((prev) => ({ ...prev, [key]: false }));
          setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
          setReactionError('signal lost — try again');
          setTimeout(() => setReactionError(null), 3500);
        }
      }).catch(() => {
        // Network failure — revert and inform
        setReacted((prev) => ({ ...prev, [key]: false }));
        setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
        setReactionError('signal lost — try again');
        setTimeout(() => setReactionError(null), 3500);
      });
    }
  }

  const mode = getAuthorMode(post);
  const tags = isOP && 'tags' in post ? post.tags : null;
  const time = 'createdAt' in post ? post.createdAt : '';

  return (
    <div className={`thread-post ${isOP ? 'thread-post-op' : ''}`} id={`post-${postNumber}`}>
      {/* Post header */}
      <div className="post-header">
        <span className="post-number">#{postNumber}</span>
        <span className="post-separator">·</span>
        <span className={`post-handle ${isOP ? 'post-handle-op' : ''}`}>
          {post.authorHandle}
        </span>
        <span className={`post-identity-badge ${mode === 'ghost' ? 'ghost' : ''}`}>
          {mode === 'ghost' ? 'GHOST' : 'ANON'}
        </span>
        {isOP && <span className="post-op-tag">OP</span>}
        <span className="post-time">{time}</span>
      </div>

      {/* Post body */}
      <div className="post-body">
        {renderBody(post.body)}
      </div>

      {/* Tags (OP only) */}
      {tags && tags.length > 0 && (
        <div className="post-tags">
          {tags.map((tag) => (
            <span key={tag} className="post-tag">{tag}</span>
          ))}
        </div>
      )}

      {/* Reactions */}
      <div className="post-reactions">
        {REACTION_DEFS.map(({ key, glyph, label }) => (
          <button
            key={key}
            onClick={() => toggleReaction(key)}
            className={`reaction-btn ${reacted[key] ? 'reacted' : ''}`}
            title={`${label}: ${counts[key]}`}
          >
            {glyph} {counts[key]} {label}
          </button>
        ))}
      </div>

      {/* Reaction error */}
      {reactionError && (
        <div className="mt-2 text-[12px] uppercase tracking-[0.16em] text-red-400/65">
          › {reactionError}
        </div>
      )}

      {/* Post footer: permalink + report */}
      <div className="post-permalink flex items-center justify-between">
        <a href={`#post-${postNumber}`} className="post-permalink-link">
          &gt;&gt;{postNumber}
        </a>
        <button
          onClick={() => setReportOpen(true)}
          className="text-[11px] uppercase tracking-[0.16em] text-crt/25 transition-colors hover:text-crt/52"
          title="Report this post"
        >
          [ report ]
        </button>
      </div>

      {/* Report modal */}
      {reportOpen && (
        <ReportModal
          targetType={isOP ? 'thread' : 'reply'}
          targetId={resolveTargetId(post, isOP)}
          postNumber={postNumber}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
