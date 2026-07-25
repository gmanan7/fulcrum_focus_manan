import { cn } from '@/lib/utils';
import { formatBadgeCount } from '@/lib/navBadge';

interface NavBadgeProps {
  count: number;
  className?: string;
}

/**
 * iOS-style red notification badge for nav icons.
 * Hidden when count is 0. Grows slightly for 3-digit "99+".
 */
export function NavBadge({ count, className }: NavBadgeProps) {
  const label = formatBadgeCount(count);
  const visible = label !== null;
  const wide = label === '99+';

  return (
    <span
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground font-bold leading-none transition-transform duration-200 ease-out',
        wide ? 'h-5 min-w-[20px] px-1 text-[10px]' : 'h-4 min-w-[16px] px-1 text-[10px]',
        visible ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
        className,
      )}
      data-testid="nav-badge"
    >
      {label}
    </span>
  );
}
