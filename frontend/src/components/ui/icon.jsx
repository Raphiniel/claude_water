import { cn } from '../../lib/utils';

/** Lucide sizes aligned with shadcn/ui conventions */
export const iconSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 40,
};

/**
 * Renders a Lucide icon (same set used by shadcn/ui).
 * @param {import('lucide-react').LucideIcon} icon - Lucide component
 */
export function Icon({
  icon: IconComponent,
  size = 'md',
  className,
  strokeWidth = 2,
  ...props
}) {
  if (!IconComponent) return null;
  const dimension = typeof size === 'number' ? size : iconSizes[size] ?? iconSizes.md;
  const { 'aria-label': ariaLabel, ...rest } = props;

  return (
    <IconComponent
      size={dimension}
      strokeWidth={strokeWidth}
      className={cn('shrink-0', className)}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      {...rest}
    />
  );
}
