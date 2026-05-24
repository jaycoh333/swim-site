import { GhostIdentity } from '@/lib/forum-types';

interface GhostPanelProps {
  ghost: GhostIdentity;
}

export function GhostPanel({ ghost }: GhostPanelProps) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-crt/12 px-3 py-2">
        <span className="text-[13px] uppercase tracking-[0.22em] text-phosphor/68">
          {ghost.label}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-crt/24">
          identity
        </span>
      </div>

      <div className="grid gap-3 p-3 md:grid-cols-[82px_1fr]">
        <pre className="archive-stat flex h-[82px] items-center justify-center text-center text-[11px] leading-tight text-crt/68">
          {ghost.sigil.join('\n')}
        </pre>

        <div className="space-y-2 text-[0.98rem] leading-tight">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-crt/28">handle</div>
            <div className="text-crt">{ghost.handle}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-crt/50">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-crt/28">join date</div>
              <div>{ghost.joinedAt}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-crt/28">echoes received</div>
              <div>{ghost.echoesReceived}</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-crt/28">active in</div>
            <div className="text-crt/56">{ghost.activeCategories.join(' / ')}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-crt/28">archived threads</div>
            <div className="text-crt/56">{ghost.archivedThreadIds.join(' / ')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
