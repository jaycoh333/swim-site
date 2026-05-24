export function AmbientGrid({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
      style={{
        backgroundImage: `
          linear-gradient(rgba(124,255,91,.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(124,255,91,.035) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        animation: 'grid-shift 25s linear infinite',
      }}
    />
  );
}
