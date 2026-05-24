'use client';

import { motion } from 'framer-motion';

interface ArchiveCardProps {
  id: string;
  category: string;
  timestamp: string;
  excerpt: string;
  signalStrength?: number;
  replies?: number;
  index?: number;
}

export function ArchiveCard({
  id,
  category,
  timestamp,
  excerpt,
  signalStrength = 3,
  replies = 0,
  index = 0,
}: ArchiveCardProps) {
  const bars = Array.from({ length: 5 }, (_, i) => i < signalStrength);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="panel panel-hover cursor-pointer p-4 transition-all duration-200"
    >
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between text-xs text-crt/50 tracking-widest uppercase">
        <span className="text-phosphor/70">[{category}]</span>
        <span>{timestamp}</span>
      </div>

      {/* Thread ID */}
      <div className="mb-2 text-xs text-crt/30 font-ibm-plex">#{id}</div>

      {/* Excerpt */}
      <p className="text-base text-crt/80 leading-relaxed line-clamp-3">&gt; {excerpt}</p>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1" title={`Signal: ${signalStrength}/5`}>
          {bars.map((lit, i) => (
            <span
              key={i}
              className={`h-2.5 w-1 ${lit ? 'bg-crt' : 'bg-crt/15'}`}
              style={{ boxShadow: lit ? '0 0 4px rgba(124,255,91,.6)' : 'none' }}
            />
          ))}
        </div>
        {replies > 0 && (
          <span className="text-xs text-crt/40">{replies} echoes</span>
        )}
      </div>
    </motion.div>
  );
}
