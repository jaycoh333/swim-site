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
    <motion.div
      initial={animate ? { opacity: 0, y: 10 } : false}
      whileInView={animate ? { opacity: 1, y: 0 } : undefined}
      viewport={animate ? { once: true } : undefined}
      transition={animate ? { duration: 0.45 } : undefined}
      className={`panel flex flex-col ${className}`}
    >
      {/* Title bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-crt/20 px-4 py-2">
        <span className="text-sm tracking-widest text-phosphor/75 uppercase">
          // {title}
        </span>
        <span className="text-xs text-crt/25">v{version}</span>
      </div>
      {/* Body */}
      <div className="flex-1 p-4 font-mono text-sm leading-relaxed">
        {children}
        {showCursor && (
          <span
            className="ml-1 inline-block h-[1em] w-2 bg-crt align-middle animate-blink"
            aria-hidden="true"
          />
        )}
      </div>
    </motion.div>
  );
}
