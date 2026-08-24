import { cn } from '@/lib/utils';

export function ProgressBar({ progress, className }: { progress: number; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line', className)}>
      <div
        className="h-full rounded-full bg-accent transition-all duration-300"
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
    </div>
  );
}
