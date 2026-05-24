export function TerminalPanel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel relative p-4 md:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between border-b border-crt/35 pb-2 text-lg tracking-wider text-phosphor">
        <span>// {title}</span>
        <span className="opacity-60">VER 0.1.0</span>
      </div>
      {children}
    </section>
  );
}
