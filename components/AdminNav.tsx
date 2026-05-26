// Shared admin navigation bar for all scanner admin pages.
// Renders as plain links — works in both server and client component trees.

interface AdminNavProps {
  current?: 'admin' | 'sources' | 'queue';
}

const NAV_LINKS = [
  { href: '/scanner/admin',   label: '⌂ Admin Hub',     key: 'admin'   },
  { href: '/scanner/sources', label: '⊞ Sources',       key: 'sources' },
  { href: '/scanner/queue',   label: '≡ Signal Queue',  key: 'queue'   },
  { href: '/scanner',         label: '◈ Scanner',       key: 'public'  },
] as const;

export function AdminNav({ current }: AdminNavProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {NAV_LINKS.map(({ href, label, key }) => {
        const isActive = current === key;
        return (
          <a
            key={key}
            href={href}
            className="inline-flex min-h-[44px] items-center border px-4 py-2 text-[16px] font-bold transition-colors"
            style={{
              borderColor: isActive ? 'rgba(134,212,110,0.55)' : 'rgba(134,212,110,0.20)',
              color:       isActive ? '#86d46e'                : 'rgba(134,212,110,0.52)',
              background:  isActive ? 'rgba(134,212,110,0.10)' : 'transparent',
            }}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
