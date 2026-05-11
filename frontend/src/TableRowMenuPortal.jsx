import { createPortal } from 'react-dom';

const Z_BACKDROP = 490;
const Z_MENU = 500;

/**
 * Fixed-position row menu rendered via portal so it is not clipped by
 * .table-wrapper overflow or glass-panel stacking contexts.
 *
 * anchor: null | { x: number, y: number } — x/y from getBoundingClientRect()
 * (x = trigger right edge, y = bottom + gap, same convention as Technicians).
 */
export default function TableRowMenuPortal({ anchor, onClose, minWidth = '180px', children }) {
  if (!anchor) return null;
  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: Z_BACKDROP }} onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        style={{
          position: 'fixed',
          right: window.innerWidth - anchor.x,
          top: anchor.y,
          zIndex: Z_MENU,
          background: '#141414',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          minWidth,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
        }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

export function toggleRowMenuAnchor(prev, id, triggerEl) {
  const rect = triggerEl.getBoundingClientRect();
  return prev?.id === id ? null : { id, x: rect.right, y: rect.bottom + 4 };
}
