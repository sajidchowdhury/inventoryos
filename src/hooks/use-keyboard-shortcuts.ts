'use client';

// useKeyboardShortcuts — adds desktop-only keyboard shortcuts.
// Shortcuts are only active on desktop (≥ 768px) because they require
// a physical keyboard and don't apply on touch devices.
//
// Shortcuts:
//   Cmd+K / Ctrl+K → open command palette (handled in CommandPalette)
//   N              → new product (when not typing in an input)
//   S              → new sale / dispense (when not typing in an input)
//   /              → focus the search box (when not typing in an input)
//   ?              → show keyboard shortcuts help (future)
//   Escape         → close any open modal/palette (handled by components)
//
// Usage:
//   useKeyboardShortcuts({ onNewProduct, onNewSale, onFocusSearch });

import { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ShortcutHandlers {
  onNewProduct?: () => void;
  onNewSale?: () => void;
  onFocusSearch?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return; // shortcuts only on desktop

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if the user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) {
          return;
        }
        // Skip if inside a select dropdown
        if (target.closest('[role="combobox"]') || target.closest('[role="listbox"]')) {
          return;
        }
      }

      // Skip if any modifier key is pressed (except for Cmd+K/Ctrl+K which
      // is handled by the CommandPalette itself)
      if (e.altKey || e.shiftKey) return;

      switch (e.key.toLowerCase()) {
        case 'n':
          if (handlers.onNewProduct) {
            e.preventDefault();
            handlers.onNewProduct();
          }
          break;
        case 's':
          if (handlers.onNewSale) {
            e.preventDefault();
            handlers.onNewSale();
          }
          break;
        case '/':
          if (handlers.onFocusSearch) {
            e.preventDefault();
            handlers.onFocusSearch();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, handlers.onNewProduct, handlers.onNewSale, handlers.onFocusSearch]);
}
