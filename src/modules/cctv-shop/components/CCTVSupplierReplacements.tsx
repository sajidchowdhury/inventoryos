'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, Plus, Send, X, RefreshCw, CheckCircle2,
  AlertCircle, Package, Building2,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface SupplierReplacement {
  id: string;
  originalSerialNumber: string | null;
  newSerialNumber: string | null;
  productName: string | null;
  supplierName: string | null;
  status: string;
  quantity: number;
  isSerialTracked: boolean;
  sentDate: string;
  receivedDate: string | null;
  notes: string | null;
  repairId: string | null;
  createdAt: string;
}

interface Supplier {
  id: string;
  name: string;
  phone: string;
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; icon: typeof Send }> = {
  sent: { label: 'Sent', color: 'text-orange-700', bg: 'bg-orange-50', icon: Send },
  received: { label: 'Received', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'text-gray-700', bg: 'bg-gray-100', icon: X },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function CCTVSupplierReplacements() {
  const { goBack, contextId } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();

  const [replacements, setReplacements] = useState<SupplierReplacement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formMode, setFormMode] = useState<'serial' | 'stock'>('serial');
  const [originalSerialNumber, setOriginalSerialNumber] = useState('');
  const [stockProductId, setStockProductId] = useState('');
  const [stockQuantity, setStockQuantity] = useState('1');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [repairId, setRepairId] = useState('');
  const [saving, setSaving] = useState(false);

  // Found product info from serial
  const [foundProduct, setFoundProduct] = useState<{ name: string; brand: string; status: string } | null>(null);
  const [serialSearching, setSerialSearching] = useState(false);

  // Products for stock mode
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Receive replacement dialog
  const [receiveItem, setReceiveItem] = useState<SupplierReplacement | null>(null);
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiving, setReceiving] = useState(false);

  const loadReplacements = () => {
    if (!businessId) return;
    setLoading(true);
    fetch(`/api/businesses/${businessId}/cctv/supplier-replacements`)
      .then((r) => r.json())
      .then((data) => {
        setReplacements(data.replacements || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const loadSuppliers = () => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/suppliers`)
      .then((r) => r.json())
      .then((data) => setSuppliers(Array.isArray(data) ? data : data.suppliers || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadReplacements();
    loadSuppliers();
    // Load products for stock mode
    if (businessId) {
      fetch(`/api/businesses/${businessId}/cctv/products?limit=100`)
        .then((r) => r.json())
        .then((data) => setProducts(data.products || []))
        .catch(() => {});
    }
  }, [businessId]);

  // If navigated from repair detail with contextId, open the form pre-filled
  useEffect(() => {
    if (contextId && replacements.length > 0) {
      // Check if contextId is a repair ID (no matching replacement found) or a replacement ID
      const matching = replacements.find((r) => r.id === contextId);
      if (matching) {
        setReceiveItem(matching);
      } else {
        // It's a repair ID — open the form
        setRepairId(contextId);
        setShowForm(true);
      }
    }
  }, [contextId, replacements]);

  // Debounced serial lookup
  useEffect(() => {
    if (!originalSerialNumber.trim() || !businessId) {
      setFoundProduct(null);
      return;
    }
    setSerialSearching(true);
    const timeout = setTimeout(() => {
      fetch(`/api/businesses/${businessId}/cctv/serial-history?search=${encodeURIComponent(originalSerialNumber.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.results && data.results.length > 0) {
            const exact = data.results.find((x: any) => x.serialNumber === originalSerialNumber.trim()) || data.results[0];
            setFoundProduct({
              name: exact.product?.name || 'Unknown',
              brand: exact.product?.brand || '',
              status: exact.status,
            });
          } else {
            setFoundProduct(null);
          }
          setSerialSearching(false);
        })
        .catch(() => setSerialSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [originalSerialNumber, businessId]);

  const handleCreate = async () => {
    if (formMode === 'serial' && !originalSerialNumber.trim()) {
      toast({ title: 'Error', description: 'Original serial number is required', variant: 'destructive' });
      return;
    }
    if (formMode === 'stock' && !stockProductId) {
      toast({ title: 'Error', description: 'Select a product', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        supplierId: supplierId || null,
        repairId: repairId || null,
        notes: notes || null,
      };
      if (formMode === 'serial') {
        payload.originalSerialNumber = originalSerialNumber.trim();
      } else {
        payload.productId = stockProductId;
        payload.quantity = parseInt(stockQuantity) || 1;
      }

      const res = await fetch(`/api/businesses/${businessId}/cctv/supplier-replacements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const label = formMode === 'serial' ? originalSerialNumber : `${stockQuantity} item(s)`;
        toast({ title: 'Sent to supplier', description: `Replacement requested for ${label}` });
        setShowForm(false);
        setOriginalSerialNumber(''); setSupplierId(''); setNotes(''); setRepairId('');
        setStockProductId(''); setStockQuantity('1'); setProductSearch('');
        setFoundProduct(null);
        loadReplacements();
      } else {
        const data = await res.json();
        toast({ title: data.error || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async () => {
    if (!receiveItem) return;
    // For serial-tracked: require new serial number
    if (receiveItem.isSerialTracked !== false && !newSerialNumber.trim()) {
      toast({ title: 'Error', description: 'New serial number is required', variant: 'destructive' });
      return;
    }
    setReceiving(true);
    try {
      const payload: any = {
        notes: receiveNotes || undefined,
      };
      if (receiveItem.isSerialTracked === false) {
        // Non-serial: just mark as received
        payload.action = 'receive';
        payload.status = 'received';
      } else {
        // Serial: provide new serial number
        payload.newSerialNumber = newSerialNumber.trim();
      }

      const res = await fetch(`/api/businesses/${businessId}/cctv/supplier-replacements/${receiveItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const msg = receiveItem.isSerialTracked === false
          ? `${receiveItem.quantity} item(s) added back to stock`
          : `New serial ${newSerialNumber} added to stock`;
        toast({ title: 'Replacement received', description: msg });
        setReceiveItem(null);
        setNewSerialNumber(''); setReceiveNotes('');
        loadReplacements();
      } else {
        const data = await res.json();
        toast({ title: data.error || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setReceiving(false);
    }
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Supplier Replacements</h1>
        <button onClick={() => setShowForm(true)}
          className="h-9 px-4 rounded-xl bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      <p className="text-xs text-gray-500 px-1">
        Send defective products to suppliers and track replacements with new serial numbers.
      </p>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : replacements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <RefreshCw className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No replacements yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Tap "New" to send a defective product to a supplier
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {replacements.map((r) => {
            const status = STATUS_STYLES[r.status] || STATUS_STYLES.sent;
            const StatusIcon = status.icon;
            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Original — serial or stock */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-gray-400 font-medium">ORIGINAL</span>
                      {r.isSerialTracked === false && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-semibold">IN-STOCK</span>
                      )}
                    </div>
                    {r.isSerialTracked !== false ? (
                      <p className="text-sm font-mono font-semibold text-gray-900 break-all">{r.originalSerialNumber}</p>
                    ) : (
                      <p className="text-sm font-semibold text-gray-900">{r.productName}</p>
                    )}
                    {r.productName && r.isSerialTracked !== false && <p className="text-xs text-gray-600 mt-0.5">{r.productName}</p>}
                    {r.isSerialTracked === false && (
                      <p className="text-xs text-gray-500 mt-0.5">Qty: {r.quantity} damaged item(s)</p>
                    )}

                    {/* Arrow + new serial (if received) */}
                    {r.newSerialNumber && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3 text-cyan-500" />
                          <span className="text-[9px] text-cyan-600 font-medium">REPLACEMENT</span>
                        </div>
                        <p className="text-sm font-mono font-semibold text-cyan-700 break-all">{r.newSerialNumber}</p>
                      </div>
                    )}
                    {r.isSerialTracked === false && r.status === 'received' && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3 text-emerald-500" />
                          <span className="text-[9px] text-emerald-600 font-medium">REPLACEMENT RECEIVED</span>
                        </div>
                        <p className="text-sm font-semibold text-emerald-700">{r.quantity} item(s) added to stock</p>
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                      {r.supplierName && (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 flex items-center gap-1">
                          <Building2 className="w-2.5 h-2.5" /> {r.supplierName}
                        </span>
                      )}
                      <span className="text-gray-400">Sent: {formatDate(r.sentDate)}</span>
                      {r.receivedDate && (
                        <span className="text-gray-400">Received: {formatDate(r.receivedDate)}</span>
                      )}
                    </div>
                  </div>
                  <span className={cn('shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1', status.bg, status.color)}>
                    <StatusIcon className="w-3 h-3" /> {status.label}
                  </span>
                </div>

                {/* Action: receive replacement */}
                {r.status === 'sent' && (
                  <button
                    onClick={() => setReceiveItem(r)}
                    className="mt-3 w-full h-10 rounded-xl bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Receive Replacement
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Replacement Form Dialog */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900">Send to Supplier</h3>
                <button onClick={() => setShowForm(false)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Mode toggle */}
                {!repairId && (
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                    <button
                      onClick={() => setFormMode('serial')}
                      className={cn(
                        'flex-1 h-8 rounded-lg text-xs font-semibold transition-colors',
                        formMode === 'serial' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500'
                      )}
                    >
                      Serial Tracked
                    </button>
                    <button
                      onClick={() => setFormMode('stock')}
                      className={cn(
                        'flex-1 h-8 rounded-lg text-xs font-semibold transition-colors',
                        formMode === 'stock' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'
                      )}
                    >
                      In-Stock (Damaged)
                    </button>
                  </div>
                )}

                {formMode === 'serial' ? (
                  /* Serial mode */
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600">Original Serial Number *</Label>
                    <Input value={originalSerialNumber} onChange={(e) => setOriginalSerialNumber(e.target.value)}
                      placeholder="Type or scan serial..." className="h-10 rounded-xl font-mono text-sm" autoFocus />
                    {serialSearching && (
                      <p className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Looking up serial...
                      </p>
                    )}
                    {foundProduct && (
                      <div className="bg-emerald-50 rounded-lg p-2 text-xs">
                        <p className="font-semibold text-emerald-800">{foundProduct.name}</p>
                        <p className="text-emerald-600">{foundProduct.brand} · Status: {foundProduct.status}</p>
                      </div>
                    )}
                    {originalSerialNumber.trim() && !foundProduct && !serialSearching && (
                      <p className="text-[10px] text-amber-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Serial not found in system.
                      </p>
                    )}
                  </div>
                ) : (
                  /* Stock mode — for damaged in-house products */
                  <div className="space-y-3">
                    <div className="bg-orange-50 rounded-lg p-2 text-xs text-orange-700">
                      Use this mode when you have damaged items in stock that need to be sent to the supplier for replacement. Stock will be decremented now and incremented when replacement arrives.
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600">Product *</Label>
                      <select value={stockProductId} onChange={(e) => setStockProductId(e.target.value)}
                        className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white">
                        <option value="">Select product...</option>
                        {products.filter(p => !p.serialTracked).map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.brand}) — Stock: {p.stock}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600">Quantity (damaged items)</Label>
                      <Input type="number" value={stockQuantity}
                        onChange={(e) => setStockQuantity(e.target.value)}
                        className="h-10 rounded-xl text-sm" min="1" />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Supplier</Label>
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white">
                    <option value="">Select supplier (optional)</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} — {s.phone}</option>
                    ))}
                  </select>
                </div>

                {repairId && (
                  <div className="bg-violet-50 rounded-lg p-2 text-xs text-violet-700">
                    Linked to repair: {repairId.slice(-8)}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Notes (optional)</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe the defect sent to supplier..." className="rounded-xl resize-none" rows={3} />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || (formMode === 'serial' ? !originalSerialNumber.trim() : !stockProductId)}
                  className="flex-1 h-11 rounded-xl bg-orange-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {saving ? 'Sending...' : 'Send to Supplier'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receive Replacement Dialog */}
      <AnimatePresence>
        {receiveItem && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900">Receive Replacement</h3>
                <button onClick={() => setReceiveItem(null)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                  {receiveItem.isSerialTracked !== false ? (
                    <>
                      <p className="text-[10px] text-gray-500">Original Serial</p>
                      <p className="text-sm font-mono font-semibold text-gray-900 break-all">{receiveItem.originalSerialNumber}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] text-gray-500">Product (In-Stock)</p>
                      <p className="text-sm font-semibold text-gray-900">{receiveItem.productName}</p>
                      <p className="text-xs text-gray-500">Quantity sent: {receiveItem.quantity}</p>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-center text-cyan-500">
                  <RefreshCw className="w-5 h-5" />
                </div>

                {receiveItem.isSerialTracked !== false ? (
                  /* Serial mode: ask for new serial number */
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600">New Serial Number *</Label>
                    <Input value={newSerialNumber} onChange={(e) => setNewSerialNumber(e.target.value)}
                      placeholder="Scan or type the new serial..." className="h-10 rounded-xl font-mono text-sm" autoFocus />
                    <p className="text-[10px] text-gray-400">
                      This serial will be added to stock and linked to the original. Old serial will be marked as REPLACED.
                    </p>
                  </div>
                ) : (
                  /* Non-serial mode: just confirm receipt */
                  <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-700">
                    Click "Receive" to add {receiveItem.quantity} item(s) back to stock. The replacement items are assumed to be in good condition.
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Notes (optional)</Label>
                  <Textarea value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)}
                    placeholder="Any notes from supplier..." className="rounded-xl resize-none" rows={2} />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setReceiveItem(null)}
                  className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleReceive}
                  disabled={receiving || (receiveItem.isSerialTracked !== false && !newSerialNumber.trim())}
                  className="flex-1 h-11 rounded-xl bg-emerald-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {receiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {receiving ? 'Receiving...' : 'Receive & Add to Stock'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
