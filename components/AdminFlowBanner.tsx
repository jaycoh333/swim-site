'use client';

/**
 * AdminFlowBanner — 4-step operator workflow indicator.
 * Shown at the top of /scanner/sources (step 1) and /scanner/queue (step 2+).
 */

const FLOW_STEPS = [
  { num: 1 as const, label: 'Scan Sources',    desc: 'Fetch one page per enabled source'    },
  { num: 2 as const, label: 'Review Evidence', desc: 'Read, verify source, check flags'      },
  { num: 3 as const, label: 'Rebirth Thread',  desc: 'Edit, complete checklist, publish'     },
  { num: 4 as const, label: 'Share Signal',    desc: 'Copy Telegram / X — no API calls'      },
];

export function AdminFlowBanner({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  return (
    <div className="border-b border-crt/12 bg-[rgba(4,7,5,0.75)] px-4 py-4 md:px-8">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-crt/28">
        Operator workflow
      </p>
      <div className="flex flex-wrap items-stretch gap-0.5">
        {FLOW_STEPS.map((step, i) => {
          const isActive = step.num === currentStep;
          const isPast   = step.num < currentStep;
          const textColor = isActive
            ? '#86d46e'
            : isPast
            ? 'rgba(134,212,110,0.40)'
            : 'rgba(134,212,110,0.16)';

          return (
            <div key={step.num} className="flex items-stretch">
              {i > 0 && (
                <div className="flex items-center px-1.5">
                  <span
                    className="text-sm select-none"
                    style={{ color: isPast ? 'rgba(134,212,110,0.28)' : 'rgba(134,212,110,0.10)' }}
                  >
                    →
                  </span>
                </div>
              )}
              <div
                className="flex flex-col justify-center px-3 py-2"
                style={{
                  background: isActive ? 'rgba(134,212,110,0.07)' : 'transparent',
                  border:     isActive ? '1px solid rgba(134,212,110,0.22)' : '1px solid transparent',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-sm font-bold tabular-nums"
                    style={{ color: textColor }}
                  >
                    {step.num}
                  </span>
                  <span
                    className="whitespace-nowrap text-sm font-semibold"
                    style={{ color: textColor }}
                  >
                    {step.label}
                  </span>
                </div>
                {isActive && (
                  <p className="mt-0.5 text-xs text-crt/38">{step.desc}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
