import React, { useEffect, useRef } from 'react';
import './MobileSheet.css';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface MobileSheetProps {
  /** Tilgjengelig navn på dialogen */
  label: string;
  onClose: () => void;
  /** 'full' fyller skjermen under toppfeltet, 'auto' tar bare den høyden innholdet trenger */
  size?: 'full' | 'auto';
  className?: string;
  children: React.ReactNode;
}

/**
 * Felles bunnark for mobil. Håndterer bakgrunn, Escape, fokus inn og ut,
 * og holder tabulatorfokus inne i arket mens det er åpent.
 */
export const MobileSheet: React.FC<MobileSheetProps> = ({
  label,
  onClose,
  size = 'auto',
  className = '',
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }
      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="mobile-sheet">
      <button
        type="button"
        className="mobile-sheet__backdrop"
        aria-label="Lukk"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`mobile-sheet__dialog mobile-sheet__dialog--${size} ${className}`.trim()}
      >
        {children}
      </div>
    </div>
  );
};

/** Lukkeknapp med 48 px treffflate, brukt øverst til høyre i arkene. */
export const MobileSheetCloseButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button type="button" className="mobile-sheet__close" aria-label="Lukk" onClick={onClick}>
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M5 5 L19 19 M19 5 L5 19" />
    </svg>
  </button>
);
