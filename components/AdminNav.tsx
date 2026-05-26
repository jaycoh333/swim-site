// Shared admin navigation bar for all scanner admin pages.
// Renders as plain links — works in both server and client component trees.

interface AdminNavProps {
  current?: 'admin' | 'sources' | 'queue' | 'console';
}

const NAV_LINKS = [
  { href: '/scanner/console', label: '▶ Scanner Console', key: 'console' },
  { href: '/scanner/admin',   label: '⌂ Admin Hub',       key: 'admin'   },
  { href: '/scanner/sources', label: '⊞ Sources',         key: 'sources' },
  { href: '/scanner/queue',   label: '≡ Signal Queue',    key: 'queue'   },
  { href: '/scanner',         label: '◈ Scanner',         key: 'public'  },
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
            className="inline-flex min-h-[52px] items-center border px-5 py-2.5 text-[17px] font-bold transition-colors hover:opacity-100"
            style={{
              borderColor: isActive ? 'rgba(134,212,110,0.60)' : 'rgba(134,212,110,0.25)',
              color:       isActive ? '#86d46e'                : 'rgba(134,212,110,0.58)',
              background:  isActive ? 'rgba(134,212,110,0.12)' : 'rgba(0,0,0,0.20)',
            }}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
