'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, AlertCircle, Shield, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──

export interface SerialEntry {
  _tempId: string;
  serialNumber: string;
  error?: string; // e.g., "Duplicate within batch"
}

interface SerialNumberEntryProps {
  /** How many serial numbers are expected (from quantity) */
  targetQty: number;
  /** Pre-filled serial numbers (for editing) */
  initialSerials?: string[];
  /** Label for the product being scanned */
  productName?: string;
  /** Callback when serial numbers change */
  onChange: (serials: string[]) => void;
  /** Read-only mode (for review step) */
  readOnly?: boolean;
}

let _tempCounter = 0;
function makeTempId() {
  return `sne_${Date.now()}_${++_tempCounter}`;
}

// ── Component ──

export function SerialNumberEntry({
  targetQty,
  initialSerials = [],
  productName,
  onChange,
  readOnly = false,
}: SerialNumberEntryProps) {
  const [entries, setEntries] = useState<SerialEntry[]>(() =>
    initialSerials.map((s) => ({
      _tempId: makeTempId(),
      serialNumber: s,
    }))
  );
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when component mounts
  useEffect(() => {
    if (!readOnly) {
      const timer = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
  }, [readOnly]);

  // Sync serials to parent whenever entries change
  useEffect(() => {
    const validSerials = entries
      .filter((e) => e.serialNumber.trim() && !e.error)
      .map((e) => e.serialNumber.trim());
    onChange(validSerials);
  }, [entries, onChange]);

  // ── Validation ──
  const validateSerial = (serial: string, excludeTempId?: string): string | undefined => {
    const trimmed = serial.trim();
    if (!trimmed) return 'Serial number is required';

    // Check duplicates within batch
    const existing = entries.find(
      (e) => e._tempId !== excludeTempId && e.serialNumber.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return 'Duplicate in this list';

    return undefined;
  };

  // ── Actions ──
  const addSerial = (value?: string) => {
    const serial = (value ?? inputValue).trim();
    if (!serial) return;

    const error = validateSerial(serial);
    const entry: SerialEntry = {
      _tempId: makeTempId(),
      serialNumber: serial,
      error,
    };

    setEntries((prev) => [...prev, entry]);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSerial();
    }
  };

  const removeSerial = (tempId: string) => {
    setEntries((prev) => prev.filter((e) => e._tempId !== tempId));
  };

  const updateSerial = (tempId: string, value: string) => {
    const trimmed = value.trim();
    setEntries((prev) =>
      prev.map((e) =>
        e._tempId === tempId
          ? { ...e, serialNumber: trimmed, error: trimmed ? validateSerial(trimmed, tempId) : undefined }
          : e
      )
    );
  };

  const clearAll = () => {
    setEntries([]);
    setInputValue('');
    inputRef.current?.focus();
  };

  // ── Computed ──
  const validCount = entries.filter((e) => e.serialNumber.trim() && !e.error).length;
  const errorCount = entries.filter((e) => e.error).length;
  const progressPct = targetQty > 0 ? Math.min(100, (validCount / targetQty) * 100) : 0;
  const isComplete = validCount >= targetQty;
  const hasPartial = validCount > 0 && validCount < targetQty;

  return (
    <div className="space-y-3">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-500" />
          <span className="text-xs font-semibold text-gray-700">
            Serial Numbers
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs font-bold',
              isComplete ? 'text-emerald-600' : hasPartial ? 'text-amber-600' : 'text-gray-400'
            )}
          >
            {validCount} of {targetQty}
          </span>
          {validCount > 0 && !readOnly && (
            <button
              onClick={clearAll}
              className="text-[10px] text-red-400 hover:text-red-600 font-medium transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {targetQty > 0 && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full transition-colors',
              isComplete
                ? 'bg-emerald-500'
                : hasPartial
                  ? 'bg-amber-400'
                  : 'bg-violet-500'
            )}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      )}

      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium"
        >
          <Check className="w-3.5 h-3.5" />
          All serial numbers entered
        </motion.div>
      )}

      {/* Input (hidden in readOnly mode) */}
      {!readOnly && (
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type or scan serial number..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
            />
          </div>
          <button
            onClick={() => addSerial()}
            disabled={!inputValue.trim()}
            className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center transition-all shrink-0',
              inputValue.trim()
                ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm active:scale-95'
                : 'bg-gray-100 text-gray-300'
            )}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Entry list */}
      <AnimatePresence mode="popLayout">
        {entries.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {entries.map((entry, idx) => (
              <motion.div
                key={entry._tempId}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.02 } }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 border',
                  entry.error
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-100'
                )}
              >
                <span className="text-[10px] text-gray-400 font-mono w-5 text-right shrink-0">
                  {idx + 1}
                </span>

                {readOnly ? (
                  <span className={cn(
                    'flex-1 text-xs font-mono truncate',
                    entry.error ? 'text-red-500' : 'text-gray-700'
                  )}>
                    {entry.serialNumber}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={entry.serialNumber}
                    onChange={(e) => updateSerial(entry._tempId, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (entry.error) return;
                        addSerial();
                      }
                    }}
                    className={cn(
                      'flex-1 text-xs font-mono bg-transparent border-none focus:outline-none min-w-0',
                      entry.error ? 'text-red-500' : 'text-gray-700'
                    )}
                  />
                )}

                {entry.error && (
                  <span className="flex items-center gap-1 text-[9px] text-red-500 font-medium shrink-0">
                    <AlertCircle className="w-3 h-3" />
                  </span>
                )}

                {!readOnly && (
                  <button
                    onClick={() => removeSerial(entry._tempId)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {entries.length === 0 && !readOnly && (
        <div className="text-center py-4">
          <Shield className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
          <p className="text-[11px] text-gray-400">
            {productName
              ? `Enter serial numbers for ${productName}`
              : 'Enter serial numbers for this item'}
          </p>
          <p className="text-[10px] text-gray-300 mt-0.5">
            Type or scan — press Enter to add each one
          </p>
        </div>
      )}

      {/* Partial entry notice */}
      {hasPartial && !isComplete && !readOnly && (
        <p className="text-[10px] text-amber-500 font-medium text-center">
          {targetQty - validCount} remaining — you can submit with partial serial numbers
        </p>
      )}
    </div>
  );
}