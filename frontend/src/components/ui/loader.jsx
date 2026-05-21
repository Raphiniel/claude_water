import { cn } from '../../lib/utils';

const SPINNER_SIZES = { sm: 18, md: 32, lg: 44 };

/**
 * @param {'page' | 'section' | 'inline' | 'overlay' | 'auth'} variant
 * @param {'sm' | 'md' | 'lg' | number} size
 */
export function Loader({
  label,
  variant = 'section',
  size = 'md',
  className,
  'aria-label': ariaLabel,
}) {
  const dim = typeof size === 'number' ? size : SPINNER_SIZES[size] ?? SPINNER_SIZES.md;
  const statusLabel = ariaLabel || label || 'Loading';

  const spinner = (
    <span
      className="ww-spinner"
      style={{ width: dim, height: dim }}
      role="status"
      aria-hidden={label ? undefined : true}
      aria-label={label ? undefined : statusLabel}
    />
  );

  return (
    <div
      className={cn('ww-loader', `ww-loader--${variant}`, className)}
      role={label ? 'status' : undefined}
      aria-live="polite"
      aria-busy="true"
      aria-label={label ? statusLabel : undefined}
    >
      {spinner}
      {label ? <span className="ww-loader-label">{label}</span> : null}
    </div>
  );
}

/** Full-page loading state for route-level data fetches */
export function PageLoader({ label = 'Loading…', className }) {
  return <Loader variant="page" label={label} className={className} />;
}

/** Centered overlay for maps, panels, and dashboard shells */
export function LoadingOverlay({ label = 'Loading…', className }) {
  return <Loader variant="overlay" label={label} className={className} />;
}

/** Small inline spinner for buttons */
export function ButtonSpinner({ size = 'sm', className }) {
  const dim = typeof size === 'number' ? size : SPINNER_SIZES[size] ?? SPINNER_SIZES.sm;
  return (
    <span
      className={cn('ww-spinner ww-spinner--btn', className)}
      style={{ width: dim, height: dim }}
      role="status"
      aria-hidden
    />
  );
}
