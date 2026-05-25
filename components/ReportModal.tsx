'use client';

/**
 * ReportModal — anonymous content reporting.
 *
 * Reports are stored in the Supabase `reports` table with no reporter identity.
 * Admin/moderator review UI is a future phase; for now curators review reports
 * directly in the Supabase dashboard.
 */

import { useState, useEffect, useCallback } from 'react';
import { reportContentAction } from '@/app/actions';

type ReportReason = 'spam' | 'illegal_content' | 'doxxing' | 'harassment' | 'off_topic' | 'other';

const REPORT_REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'spam',            label: 'spam / flooding'          },
  { value: 'doxxing',         label: 'doxxing / personal info'  },
  { value: 'harassment',      label: 'threats / harassment'     },
  { value: 'illegal_content', label: 'illegal instructions'     },
  { value: 'off_topic',       label: 'off topic / irrelevant'   },
  { value: 'other',           label: 'other'                    },
];

interface ReportModalProps {
  targetType: 'thread' | 'reply';
  targetId:   string;
  postNumber: number;
  onClose:    () => void;
}

export function ReportModal({ targetType, targetId, postNumber, onClose }: ReportModalProps) {
  const [reason,     setReason]     = useState<ReportReason | null>(null);
  const [details,    setDetails]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (!submitting) onClose();
  }, [submitting, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  async function handleSubmit() {
    if (!reason || submitting || submitted) return;
    setSubmitting(true);
    setError(null);

    const result = await reportContentAction({
      targetType,
      targetId,
      reason,
      details: details.trim() || undefined,
    });

    setSubmitting(false);

    if ('error' in result) {
      setError('signal failed — try again');
    } else {
      setSubmitted(true);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9900] flex items-start justify-center bg-black/70 px-4 pt-[16vh]"
      onClick={handleClose}
    >
      <div
        className="forum-shell w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-crt/12 px-5 py-4">
          <span className="text-[13px] uppercase tracking-[0.22em] text-crt/70">
            report post #{postNumber}
          </span>
          <button
            onClick={handleClose}
            className="text-[12px] uppercase tracking-[0.18em] text-crt/40 hover:text-crt/70 transition-colors"
          >
            [ × close ]
          </button>
        </div>

        {submitted ? (
          /* ── Success state ── */
          <div className="px-5 py-10 text-center">
            <div className="text-[13px] uppercase tracking-[0.22em] text-crt/80">
              ✓ report archived · moderator signal queued
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-crt/35">
              anonymous · no identity logged
            </p>
            <button
              onClick={onClose}
              className="mt-7 border border-crt/22 px-5 py-2 text-[12px] uppercase tracking-[0.18em] text-crt/48 transition-colors hover:border-crt/38 hover:text-crt/72"
            >
              [ close ]
            </button>
          </div>
        ) : (
          /* ── Report form ── */
          <div className="px-5 py-5">

            {/* Reason selector */}
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-crt/38">
              select reason
            </div>
            <div className="mb-5 space-y-0.5">
              {REPORT_REASONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setReason(value)}
                  className={`w-full text-left px-3 py-2.5 text-[13px] tracking-[0.08em] border transition-colors ${
                    reason === value
                      ? 'border-crt/30 bg-crt/[0.05] text-crt/88'
                      : 'border-transparent text-crt/52 hover:border-crt/15 hover:text-crt/68'
                  }`}
                >
                  {reason === value ? '[●]' : '[○]'}&nbsp;&nbsp;{label}
                </button>
              ))}
            </div>

            {/* Optional details */}
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.22em] text-crt/38">
              details <span className="text-crt/22">(optional)</span>
            </div>
            <textarea
              className="composer-textarea mb-4"
              rows={3}
              placeholder="additional context if needed..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              disabled={submitting}
              maxLength={500}
            />

            {/* Error */}
            {error && (
              <div className="mb-3 border border-red-900/40 bg-[rgba(40,10,10,0.6)] px-3 py-2 text-[12px] uppercase tracking-[0.18em] text-red-400/80">
                › {error}
              </div>
            )}

            {/* Actions row */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleClose}
                className="text-[12px] uppercase tracking-[0.16em] text-crt/38 transition-colors hover:text-crt/62"
              >
                cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting || submitted}
                className="composer-submit disabled:cursor-not-allowed disabled:opacity-35"
              >
                {submitting ? '↯ sending...' : '[ submit report ]'}
              </button>
            </div>

            {/* Identity + future phase note */}
            <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-crt/25">
              anonymous · no identity logged · admin panel: future phase
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
