const CONTRACT = '2E4rR7pRVsvcnsyZcoYZqqDP6dcqMgrYAcnw';

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

      </div>
    </div>
  );
}
