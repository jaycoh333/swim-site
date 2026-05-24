export function Scanlines({ opacity = 0.06 }: { opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9998]"
      style={{
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0,0,0,${opacity}) 2px,
          rgba(0,0,0,${opacity}) 4px
        )`,
      }}
    />
  );
}
