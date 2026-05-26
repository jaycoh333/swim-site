'use client';

const FLOW_STEPS = [
  { num: 1 as const, label: 'Scan Sources',    desc: 'Run a session — one page per enabled source, no crawl'  },
  { num: 2 as const, label: 'Queue Candidate', desc: 'Review the preview, edit fields, then add to the queue' },
  { num: 3 as const, label: 'Review Signal',   desc: 'Read evidence, verify source, mark Rebirth Ready'       },
  { num: 4 as const, label: 'Rebirth Thread',  desc: 'Edit body, complete checklist, publish as a thread'     },
  { num: 5 as const, label: 'Copy Socials',    desc: 'Copy Telegram and X post — no API calls made'           },
];

export function AdminFlowBanner({ currentStep }: { currentStep: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div className="border-b border-crt/12 bg-[rgba(4,7,5,0.80)] px-4 py-5 md:px-8">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-crt/28">
        Operator workflow
      </p>
      <div className="flex flex-wrap items-start gap-0">
        {FLOW_STEPS.map((step, i) => {
          const isActive = step.num === currentStep;
          const isPast   = step.num < currentStep;
          const numColor  = isActive ? '#86d46e' : isPast ? 'rgba(134,212,110,0.45)' : 'rgba(134,212,110,0.16)';
          const textColor = isActive ? '#86d46e' : isPast ? 'rgba(134,212,110,0.42)' : 'rgba(134,212,110,0.18)';

          return (
            <div key={step.num} className="flex items-start">
              {i > 0 && (
                <div className="flex items-center pt-4 px-1.5">
                  <span
                    className="select-none text-base"
                    style={{ color: isPast ? 'rgba(134,212,110,0.25)' : 'rgba(134,212,110,0.10)' }}
                  >
                    →
                  </span>
                </div>
              )}
              <div
                className="flex min-w-[88px] flex-col px-4 py-3"
                style={{
                  background: isActive ? 'rgba(134,212,110,0.07)' : 'transparent',
                  border:     isActive ? '1px solid rgba(134,212,110,0.25)' : '1px solid transparent',
                }}
              >
                <span
                  className="font-mono font-black leading-none tabular-nums"
                  style={{ fontSize: '2.5rem', color: numColor }}
                >
                  {step.num}
                </span>
                <span
                  className="mt-1 whitespace-nowrap text-base font-bold uppercase tracking-wide"
                  style={{ color: textColor }}
                >
                  {step.label}
                </span>
                {isActive && (
                  <p className="mt-1.5 max-w-[160px] text-sm leading-snug text-crt/42">
                    {step.desc}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
