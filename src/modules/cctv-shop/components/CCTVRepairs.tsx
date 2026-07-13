'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, Plus, Wrench, X, Phone, User, Package,
  CheckCircle2, Send, RefreshCw, AlertCircle, ChevronRight,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Repair {
  id: string;
  serialNumber: string;
  productName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  issue: string;
  status: string;
  receivedDate: string;
  repairStartDate: string | null;
  readyDate: string | null;
  returnedDate: string | null;
  repairNotes: string | null;
  repairCost: number;
  replacementId: string | null;
  createdAt: string;
}

const STATUS_FLOW: Record<string, { label: string; color: string; bg: string; icon: typeof Wrench }> = {
  received: { label: 'Received', color: 'text-amber-700', bg: 'bg-amber-50', icon: Package },
  in_repair: { label: 'In Repair', color: 'text-blue-700', bg: 'bg-blue-50', icon: Wrench },
  ready: { label: 'Ready', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  returned: { label: 'Returned', color: 'text-violet-700', bg: 'bg-violet-50', icon: RefreshCw },
  sent_to_supplier: { label: 'Sent to Supplier', color: 'text-orange-700', bg: 'bg-orange-50', icon: Send },
  replaced: { label: 'Replaced', color: 'text-cyan-700', bg: 'bg-cyan-50', icon: RefreshCw },
  closed: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-100', icon: CheckCircle2 },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function CCTVRepairs() {
  const { goBack, navigate, contextId } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();

  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);

  // Form state
  const [serialNumber, setSerialNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [issue, setIssue] = useState('');
  const [repairNotes, setRepairNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Found product info from serial
  const [foundProduct, setFoundProduct] = useState<{ name: string; brand: string; status: string } | null>(null);
  const [serialSearching, setSerialSearching] = useState(false);

  // Status update state (in detail view)
  const [statusNotes, setStatusNotes] = useState('');
  const [statusCost, setStatusCost] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadRepairs = () => {
    if (!businessId) return;
    setLoading(true);
    fetch(`/api/businesses/${businessId}/cctv/repairs`)
      .then((r) => r.json())
      .then((data) => {
        setRepairs(data.repairs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadRepairs();
  }, [businessId]);

  // If contextId is set (clicked from somewhere), load that repair
  useEffect(() => {
    if (contextId && repairs.length > 0) {
      const r = repairs.find((x) => x.id === contextId);
      if (r) setSelectedRepair(r);
    }
  }, [contextId, repairs]);

  // Debounced serial lookup
  useEffect(() => {
    if (!serialNumber.trim() || !businessId) {
      setFoundProduct(null);
      return;
    }
    setSerialSearching(true);
    const timeout = setTimeout(() => {
      fetch(`/api/businesses/${businessId}/cctv/serial-history?search=${encodeURIComponent(serialNumber.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.results && data.results.length > 0) {
            const exact = data.results.find((x: any) => x.serialNumber === serialNumber.trim()) || data.results[0];
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
  }, [serialNumber, businessId]);

  const handleCreate = async () => {
    if (!serialNumber.trim()) {
      toast({ title: 'Error', description: 'Serial number is required', variant: 'destructive' });
      return;
    }
    if (!issue.trim()) {
      toast({ title: 'Error', description: 'Issue description is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/repairs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNumber: serialNumber.trim(),
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          issue: issue.trim(),
          repairNotes: repairNotes || null,
        }),
      });
      if (res.ok) {
        toast({ title: 'Repair received', description: `Job created for ${serialNumber}` });
        setShowForm(false);
        setSerialNumber(''); setCustomerName(''); setCustomerPhone(''); setIssue(''); setRepairNotes('');
        setFoundProduct(null);
        loadRepairs();
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

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedRepair) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/repairs/${selectedRepair.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          repairNotes: statusNotes || undefined,
          repairCost: statusCost || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: 'Status updated', description: `${STATUS_FLOW[newStatus]?.label || newStatus}` });
        setSelectedRepair(data.repair);
        setStatusNotes(''); setStatusCost('');
        loadRepairs();
      } else {
        const data = await res.json();
        toast({ title: data.error || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const filteredRepairs = repairs.filter((r) => {
    if (filter === 'open') return !['returned', 'closed', 'replaced'].includes(r.status);
    if (filter === 'closed') return ['returned', 'closed', 'replaced'].includes(r.status);
    return true;
  });

  // ─── Detail View ───
  if (selectedRepair) {
    const status = STATUS_FLOW[selectedRepair.status] || STATUS_FLOW.received;
    const StatusIcon = status.icon;
    // Determine next action buttons based on current status
    const nextActions: { status: string; label: string; icon: typeof Wrench; color: string }[] = [];
    if (selectedRepair.status === 'received') {
      nextActions.push({ status: 'in_repair', label: 'Start Repair', icon: Wrench, color: 'bg-blue-500' });
      nextActions.push({ status: 'sent_to_supplier', label: 'Send to Supplier', icon: Send, color: 'bg-orange-500' });
    } else if (selectedRepair.status === 'in_repair') {
      nextActions.push({ status: 'ready', label: 'Mark Ready', icon: CheckCircle2, color: 'bg-emerald-500' });
    } else if (selectedRepair.status === 'ready') {
      nextActions.push({ status: 'returned', label: 'Return to Customer', icon: RefreshCw, color: 'bg-violet-500' });
    } else if (selectedRepair.status === 'sent_to_supplier') {
      nextActions.push({ status: 'replaced', label: 'Mark Replaced (got new serial)', icon: RefreshCw, color: 'bg-cyan-500' });
    }

    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => { setSelectedRepair(null); navigate('repairs'); }}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Repair Job</h1>
          <span className={cn('ml-auto px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5', status.bg, status.color)}>
            <StatusIcon className="w-3.5 h-3.5" /> {status.label}
          </span>
        </div>

        {/* Repair details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div>
            <p className="text-[10px] text-gray-500 font-medium">Serial Number</p>
            <p className="text-sm font-mono font-semibold text-gray-900 break-all">{selectedRepair.serialNumber}</p>
          </div>
          {selectedRepair.productName && (
            <div>
              <p className="text-[10px] text-gray-500 font-medium">Product</p>
              <p className="text-sm text-gray-800">{selectedRepair.productName}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-gray-500 font-medium">Issue</p>
            <p className="text-sm text-gray-800">{selectedRepair.issue}</p>
          </div>
          {selectedRepair.customerName && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-500 font-medium">Customer</p>
                <p className="text-sm text-gray-800 flex items-center gap-1">
                  <User className="w-3 h-3" /> {selectedRepair.customerName}
                </p>
              </div>
              {selectedRepair.customerPhone && (
                <div>
                  <p className="text-[10px] text-gray-500 font-medium">Phone</p>
                  <p className="text-sm text-gray-800 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedRepair.customerPhone}
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
            <div>
              <p className="text-[9px] text-gray-400">Received</p>
              <p className="text-xs font-semibold text-gray-700">{formatDate(selectedRepair.receivedDate)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400">Started</p>
              <p className="text-xs font-semibold text-gray-700">{formatDate(selectedRepair.repairStartDate)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400">Ready</p>
              <p className="text-xs font-semibold text-gray-700">{formatDate(selectedRepair.readyDate)}</p>
            </div>
          </div>
          {selectedRepair.repairCost > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-500 font-medium">Repair Cost</p>
              <p className="text-base font-bold text-violet-600">৳{selectedRepair.repairCost.toLocaleString()}</p>
            </div>
          )}
          {selectedRepair.repairNotes && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-500 font-medium">Notes</p>
              <p className="text-sm text-gray-700">{selectedRepair.repairNotes}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {nextActions.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-gray-700">Next Action</h3>
            <div className="grid grid-cols-1 gap-2">
              {nextActions.map((action) => (
                <button
                  key={action.status}
                  onClick={() => handleStatusUpdate(action.status)}
                  disabled={updating}
                  className={cn(
                    'flex items-center justify-center gap-2 h-11 rounded-xl text-white text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50',
                    action.color
                  )}
                >
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </button>
              ))}
            </div>

            {/* Optional notes/cost for status update */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <Input value={statusCost} onChange={(e) => setStatusCost(e.target.value)}
                type="number" placeholder="Repair cost (optional)" className="h-9 rounded-lg text-sm" min="0" />
              <Textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Add notes (optional)..." className="rounded-lg text-sm resize-none" rows={2} />
            </div>
          </div>
        )}

        {/* If sent_to_supplier, link to create replacement */}
        {selectedRepair.status === 'sent_to_supplier' && (
          <div className="bg-orange-50 rounded-2xl border border-orange-200 p-4">
            <p className="text-xs text-orange-800">
              This product has been sent to the supplier. When the replacement arrives with a new serial number,
              go to the Replacements page to record it.
            </p>
            <button
              onClick={() => navigate('replacements', selectedRepair.id)}
              className="mt-2 w-full h-10 rounded-xl bg-orange-500 text-white text-sm font-semibold"
            >
              Go to Replacements
            </button>
          </div>
        )}

        {/* If replaced, show replacement info */}
        {selectedRepair.status === 'replaced' && selectedRepair.replacementId && (
          <div className="bg-cyan-50 rounded-2xl border border-cyan-200 p-4">
            <p className="text-xs text-cyan-800 font-semibold">Replaced by supplier</p>
            <p className="text-xs text-cyan-700 mt-1">
              A new serial number has been issued. See Replacements for details.
            </p>
            <button
              onClick={() => selectedRepair.replacementId && navigate('replacements', selectedRepair.replacementId)}
              className="mt-2 w-full h-10 rounded-xl bg-cyan-500 text-white text-sm font-semibold"
            >
              View Replacement
            </button>
          </div>
        )}
      </motion.div>
    );
  }

  // ─── List View ───
  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Repairs</h1>
        <button onClick={() => setShowForm(true)}
          className="h-9 px-4 rounded-xl bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform">
          <Plus className="w-4 h-4" /> New Repair
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {[
          { key: 'all' as const, label: 'All' },
          { key: 'open' as const, label: 'Open' },
          { key: 'closed' as const, label: 'Closed' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              filter === f.key ? 'bg-violet-500 text-white' : 'bg-white border border-gray-200 text-gray-600'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : filteredRepairs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No repairs yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Tap "New Repair" to receive a product from a customer
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRepairs.map((r) => {
            const status = STATUS_FLOW[r.status] || STATUS_FLOW.received;
            const StatusIcon = status.icon;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedRepair(r)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:bg-violet-50/30 transition-colors text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-semibold text-gray-900 break-all">{r.serialNumber}</p>
                    {r.productName && <p className="text-xs text-gray-600 mt-0.5">{r.productName}</p>}
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{r.issue}</p>
                    {r.customerName && (
                      <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                        <User className="w-2.5 h-2.5" /> {r.customerName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1', status.bg, status.color)}>
                      <StatusIcon className="w-2.5 h-2.5" /> {status.label}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(r.receivedDate)}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* New Repair Form Dialog */}
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
                <h3 className="text-base font-bold text-gray-900">Receive for Repair</h3>
                <button onClick={() => setShowForm(false)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Serial number — auto-finds product */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Serial Number *</Label>
                  <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)}
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
                  {serialNumber.trim() && !foundProduct && !serialSearching && (
                    <p className="text-[10px] text-amber-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Serial not found in system. You can still create the repair.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600">Customer Name</Label>
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Optional" className="h-10 rounded-xl text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600">Phone</Label>
                    <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Optional" className="h-10 rounded-xl text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Issue *</Label>
                  <Textarea value={issue} onChange={(e) => setIssue(e.target.value)}
                    placeholder="Describe the problem..." className="rounded-xl resize-none" rows={3} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Notes (optional)</Label>
                  <Textarea value={repairNotes} onChange={(e) => setRepairNotes(e.target.value)}
                    placeholder="Any initial notes..." className="rounded-xl resize-none" rows={2} />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={saving || !serialNumber.trim() || !issue.trim()}
                  className="flex-1 h-11 rounded-xl bg-violet-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Receive'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
