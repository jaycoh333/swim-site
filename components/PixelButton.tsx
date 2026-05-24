'use client';

import { ReactNode, MouseEventHandler } from 'react';
import { motion } from 'framer-motion';

interface PixelButtonProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'bright';
  className?: string;
}

const sizes = {
  sm: 'px-4 py-2 text-lg tracking-widest',
  md: 'px-6 py-3 text-xl tracking-widest',
  lg: 'px-10 py-4 text-2xl tracking-[.2em]',
};

export function PixelButton({
  children,
  onClick,
  href,
  size = 'md',
  variant = 'default',
  className = '',
}: PixelButtonProps) {
  const base = `pixel-btn font-mono uppercase ${sizes[size]} ${className}`;

  if (href) {
    return (
      <motion.a
        href={href}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className={base}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={base}
    >
      {children}
    </motion.button>
  );
}
