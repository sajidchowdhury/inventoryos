'use client';

// CommandPalette — a Cmd+K / Ctrl+K command palette for desktop.
// Allows quick navigation to any page, search, and quick actions.
// Hidden on mobile (keyboard shortcuts don't apply on touch devices).
//
// Usage:
//   const { open } = useCommandPalette();
//   <CommandPalette commands={commands} />
//
// The palette listens for Cmd+K / Ctrl+K globally to toggle open.
// Press Escape to close. Arrow keys to navigate. Enter to select.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ArrowRight, Home, Package, ShoppingCart, Sparkles,
  MoreHorizontal, Plus, Settings, Users, BarChart3, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon: typeof Home;
  shortcut?: string;
  action: () => void;
  keywords?: string[]; // additional search keywords
}

interface CommandPaletteProps {
  commands: Command[];
  /** Controlled open state (optional). If not provided, palette manages its own state. */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ commands, isOpen, onOpenChange }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const open = isOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  // ── Keyboard shortcut: Cmd+K / Ctrl+K to toggle ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, setOpen]);

  // ── Focus input when opened ──
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // ── Filter commands by query ──
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((cmd) => {
      const text = `${cmd.label} ${cmd.description || ''} ${(cmd.keywords || []).join(' ')}`.toLowerCase();
      return text.includes(q);
    });
  }, [commands, query]);

  // ── Reset selected index when filtered list changes ──
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  // ── Keyboard navigation within the palette ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selectedIndex];
      if (cmd) {
        cmd.action();
        setOpen(false);
      }
    }
  }, [filtered, selectedIndex, setOpen]);

  // ── Scroll selected item into view ──
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm"
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 z-[101] w-[90%] max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <Search className="w-5 h-5 text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search commands or navigate..."
                className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-transparent"
              />
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-lg hover:bg-gray-100 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Command list */}
            <div ref={listRef} className="max-h-[400px] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  No commands found for "{query}"
                </div>
              ) : (
                filtered.map((cmd, i) => {
                  const Icon = cmd.icon;
                  const isSelected = i === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onMouseEnter={() => setSelectedIndex(i)}
                      onClick={() => {
                        cmd.action();
                        setOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isSelected ? 'bg-violet-50' : 'hover:bg-gray-50'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                        isSelected ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-500'
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium truncate',
                          isSelected ? 'text-violet-900' : 'text-gray-900'
                        )}>
                          {cmd.label}
                        </p>
                        {cmd.description && (
                          <p className="text-xs text-gray-400 truncate">{cmd.description}</p>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono shrink-0">
                          {cmd.shortcut}
                        </kbd>
                      )}
                      {isSelected && (
                        <ArrowRight className="w-4 h-4 text-violet-400 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono">Esc</kbd>
                  Close
                </span>
              </div>
              <span>InventoryOS Command Palette</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Default command sets for each module ──

export function useCCTVCommands(navigate: (view: string, contextId?: string) => void): Command[] {
  return [
    { id: 'home', label: 'Dashboard', description: 'Go to CCTV dashboard', icon: Home, action: () => navigate('dashboard') },
    { id: 'inventory', label: 'Inventory Hub', description: 'Manage products & stock', icon: Package, action: () => navigate('inventory-hub') },
    { id: 'products', label: 'Products List', description: 'Browse all products', icon: Package, action: () => navigate('products'), keywords: ['items', 'catalog'] },
    { id: 'add-product', label: 'Add Product', description: 'Create a new product', icon: Plus, shortcut: 'N', action: () => navigate('add-product') },
    { id: 'sell', label: 'New Sale', description: 'Start a new sale', icon: ShoppingCart, shortcut: 'S', action: () => navigate('sell'), keywords: ['pos', 'checkout'] },
    { id: 'serial-items', label: 'Serial Items', description: 'Track items by serial number', icon: Package, action: () => navigate('serial-items') },
    { id: 'customers', label: 'Customers', description: 'Manage customer list', icon: Users, action: () => navigate('customers') },
    { id: 'sales-history', label: 'Sales History', description: 'View past sales', icon: BarChart3, action: () => navigate('sales-history'), keywords: ['invoices', 'receipts'] },
    { id: 'ai', label: 'AI Center', description: 'AI insights & chat', icon: Sparkles, action: () => navigate('ai-hub') },
    { id: 'reports', label: 'Reports', description: 'View business reports', icon: BarChart3, action: () => navigate('reports') },
    { id: 'more', label: 'More', description: 'More options & settings', icon: MoreHorizontal, action: () => navigate('more-hub') },
    { id: 'profile', label: 'Profile & Settings', description: 'Account settings', icon: Settings, action: () => navigate('profile') },
  ];
}

export function usePharmacyCommands(setActiveView: (view: string) => void): Command[] {
  return [
    { id: 'home', label: 'Dashboard', description: 'Go to pharmacy dashboard', icon: Home, action: () => setActiveView('dashboard') },
    { id: 'inventory', label: 'Inventory Hub', description: 'Manage products & stock', icon: Package, action: () => setActiveView('inventory-hub') },
    { id: 'products', label: 'Products List', description: 'Browse all products', icon: Package, action: () => setActiveView('products'), keywords: ['medicines', 'catalog'] },
    { id: 'add-product', label: 'Add Product', description: 'Create a new product', icon: Plus, shortcut: 'N', action: () => setActiveView('add-product') },
    { id: 'dispense', label: 'Quick Dispense', description: 'Start a new sale', icon: ShoppingCart, shortcut: 'S', action: () => setActiveView('dispense'), keywords: ['pos', 'sell', 'checkout'] },
    { id: 'sales', label: 'Sales History', description: 'View past sales', icon: BarChart3, action: () => setActiveView('sales'), keywords: ['invoices', 'receipts'] },
    { id: 'customers', label: 'Customers', description: 'Manage customer list', icon: Users, action: () => setActiveView('customers') },
    { id: 'ai', label: 'AI Center', description: 'AI insights & chat', icon: Sparkles, action: () => setActiveView('ai-hub') },
    { id: 'reports', label: 'Reports Hub', description: 'View business reports', icon: BarChart3, action: () => setActiveView('reports-hub') },
    { id: 'more', label: 'More', description: 'More options & settings', icon: MoreHorizontal, action: () => setActiveView('more-hub') },
    { id: 'profile', label: 'Profile & Settings', description: 'Account settings', icon: Settings, action: () => setActiveView('profile') },
  ];
}
