'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface TerminalWindowProps {
  title: string;
  children: ReactNode;
  className?: string;
  showCursor?: boolean;
  animate?: boolean;
  version?: string;
}

export function TerminalWindow({
  title,
  children,
  className = '',
  showCursor = false,
  animate = true,
  version = '0.1.0',
}: TerminalWindowProps) {
  return (
    <motion.section
      initial={animate ? { opacity: 0, y: 8 } : false}
      whileInView={animate ? { opacity: 1, y: 0 } : undefined}
      viewport={animate ? { once: true } : undefined}
      transition={animate ? { duration: 0.22 } : undefined}
      className={`panel overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between border-b border-crt/12 px-3 py-2">
        <span className="text-[13px] uppercase tracking-[0.22em] text-phosphor/68">
          {title}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-crt/24">
          {version}
        </span>
      </div>

      <div className="p-3 font-mono text-sm leading-relaxed md:p-3.5">
        {children}
        {showCursor && (
          <span
            className="ml-1 inline-block h-[1em] w-2 bg-crt/62 align-middle blink"
            aria-hidden="true"
          />
        )}
      </div>
    </motion.section>
  );
}
