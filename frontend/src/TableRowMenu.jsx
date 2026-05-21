import React, { useRef, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { Icon } from './components/ui/icon';

export function TableRowMenuItem({ onClick, children, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`table-row-menu-item${danger ? ' table-row-menu-item--danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function computeAnchor(triggerEl) {
  const rect = triggerEl.getBoundingClientRect();
  const gap = 4;
  const estimatedHeight = 280;
  let top = rect.bottom + gap;
  if (top + estimatedHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - estimatedHeight - gap);
  }
  return { right: window.innerWidth - rect.right, top };
}

export default function TableRowMenu({ isOpen, onToggle, onClose, children }) {
  const triggerRef = useRef(null);
  const [anchor, setAnchor] = useState(null);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setAnchor(null);
      return undefined;
    }
    const update = () => {
      if (triggerRef.current) setAnchor(computeAnchor(triggerRef.current));
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen]);

  return (
    <div className="table-row-menu">
      <button
        ref={triggerRef}
        type="button"
        className="btn-ghost btn-more-options"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="More options"
        title="More options"
      >
        <Icon icon={MoreVertical} size="sm" />
      </button>
      {isOpen &&
        anchor &&
        createPortal(
          <>
            <div className="table-row-menu-backdrop table-row-menu-backdrop--portal" onClick={onClose} aria-hidden />
            <div
              className="table-row-menu-dropdown table-row-menu-dropdown--portal"
              role="menu"
              style={{ right: anchor.right, top: anchor.top }}
            >
              {children}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
