import { cn } from '@/lib/utils';

export type PillStatus = 'draft' | 'generating' | 'ready' | 'failed' | 'queued' | 'running';

const styles: Record<PillStatus, string> = {
  draft: 'bg-muted/10 text-muted border-line',
  queued: 'bg-warn/15 text-warn border-warn/30',
  generating: 'bg-accent/10 text-accent border-accent/30',
  running: 'bg-accent/10 text-accent border-accent/30',
  ready: 'bg-signal/10 text-signal border-signal/30',
  failed: 'bg-danger/10 text-danger border-danger/30',
};

const labels: Record<PillStatus, string> = {
  draft: 'Draft',
  queued: 'Queued',
  generating: 'Generating',
  running: 'Rendering',
  ready: 'Ready',
  failed: 'Failed',
};

export function StatusPill({ status, progress }: { status: PillStatus; progress?: number }) {
  const showPct = status === 'running' && typeof progress === 'number';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        styles[status]
      )}
    >
      {labels[status]}
      {showPct ? ` ${Math.round((progress ?? 0) * 100)}%` : ''}
    </span>
  );
}
