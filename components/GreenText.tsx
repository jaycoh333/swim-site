interface GreenTextProps {
  text: string;
  className?: string;
}

export function GreenText({ text, className = '' }: GreenTextProps) {
  const lines = text.split('\n');

  return (
    <div className={`space-y-1 font-mono text-base leading-relaxed ${className}`}>
      {lines.map((line, i) => {
        const isGreen = line.trim().startsWith('>');
        const content = isGreen ? line.replace(/^>\s?/, '') : line;
        return (
          <p key={i} className={isGreen ? 'greentext-line' : 'text-crt/60'}>
            {isGreen ? content : line}
          </p>
        );
      })}
    </div>
  );
}
