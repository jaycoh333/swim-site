'use client';

import { useState, useEffect, useRef } from 'react';

interface GlitchTextProps {
  children: string;
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
  as?: 'span' | 'h1' | 'h2' | 'p';
}

export function GlitchText({
  children,
  className = '',
  intensity = 'medium',
  as: Tag = 'span',
}: GlitchTextProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const intervals: Record<string, [number, number]> = {
      low: [5000, 12000],
      medium: [2500, 6000],
      high: [800, 2500],
    };
    const [min, max] = intervals[intensity];

    function fire() {
      setActive(true);
      setOffset({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 2 });
      timerRef.current = setTimeout(() => {
        setActive(false);
        timerRef.current = setTimeout(fire, min + Math.random() * (max - min));
      }, 80 + Math.random() * 150);
    }

    timerRef.current = setTimeout(fire, min + Math.random() * (max - min));
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [intensity]);

  return (
    <Tag className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      {active && (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 z-20 select-none"
            style={{
              color: 'rgba(255,0,64,0.75)',
              transform: `translate(${offset.x}px, ${offset.y}px)`,
              clipPath: 'polygon(0 22%, 100% 22%, 100% 26%, 0 26%)',
              mixBlendMode: 'screen',
            }}
          >
            {children}
          </span>
          <span
            aria-hidden="true"
            className="absolute inset-0 z-20 select-none"
            style={{
              color: 'rgba(0,255,200,0.75)',
              transform: `translate(${-offset.x}px, ${offset.y}px)`,
              clipPath: 'polygon(0 68%, 100% 68%, 100% 72%, 0 72%)',
              mixBlendMode: 'screen',
            }}
          >
            {children}
          </span>
        </>
      )}
    </Tag>
  );
}
