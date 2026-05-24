import { ReactNode } from 'react';

interface CRTScreenProps {
  children: ReactNode;
  className?: string;
}

export function CRTScreen({ children, className = '' }: CRTScreenProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Phosphor bloom layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(ellipse at 50% 20%, rgba(124,255,91,.04) 0%, transparent 65%)',
        }}
      />
      {/* Curved screen vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)',
        }}
      />
      <div className="relative z-0">{children}</div>
    </div>
  );
}
