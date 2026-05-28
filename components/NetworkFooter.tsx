import Link from 'next/link';

const CONTRACT = '2E4rR7pRVsvcnsyZcoYZqqDP6dcqMgrYAcnw';

const INTERNAL_LINKS = [
  { href: '/archive',  label: 'ARCHIVE'  },
  { href: '/threads',  label: 'THREADS'  },
  { href: '/scanner',  label: 'SCANNER'  },
  { href: '/signal',   label: 'SIGNAL'   },
] as const;

const SIGNAL_CHANNELS = [
  { label: 'SW1M.ME',      href: 'https://www.sw1m.me',          note: 'archive access' },
  { label: 'TELEGRAM',     href: 'https://t.me/SWIM_SOL',         note: 'signal node'    },
  { label: 'X @sw1mdotme', href: 'https://x.com/sw1mdotme',      note: 'transmission'   },
  { label: 'DEXSCREENER',  href: `https://dexscreener.com/solana/${CONTRACT}`, note: 'chart' },
] as const;

export function NetworkFooter() {
  return (
    <div className="network-footer">
      <div className="network-footer-inner">

        {/* Internal navigation */}
        <div className="network-footer-label">SECTIONS</div>
        <div className="network-footer-links">
          {INTERNAL_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="network-footer-link">
              [ {label} ]
            </Link>
          ))}
        </div>

        <div className="analog-rule my-3" />

        {/* Section header */}
        <div className="network-footer-label">SIGNAL CHANNELS</div>

        {/* Links */}
        <div className="network-footer-links">
          {SIGNAL_CHANNELS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="network-footer-link"
            >
              [ {label} ]
            </a>
          ))}
        </div>

        {/* Contract address — copyable terminal block */}
        <div className="network-footer-ca-block">
          <span className="network-footer-ca-prefix">$SWIM · CA</span>
          <span className="network-footer-ca-sep">://</span>
          <code className="network-footer-ca-addr" title="Copy contract address">
            {CONTRACT}
          </code>
        </div>

        {/* Tagline */}
        <div className="network-footer-tagline">
          the archive is public · the signal is free · someone is always watching
        </div>

        {/* Build marker — confirms deployed version; remove after deploy verified */}
        <div className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-crt/15 select-none">
          SWIM build: public-polish-v1
        </div>

      </div>
    </div>
  );
}
