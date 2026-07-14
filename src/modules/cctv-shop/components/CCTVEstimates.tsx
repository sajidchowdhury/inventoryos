'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, Plus, FileText, X, Search, Trash2, Save,
  CheckCircle2, FileEdit, FileCheck, Phone, User, Package, Printer,
  TrendingUp, Copy,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QuickPartyDialog } from './QuickPartyDialog';
import { PaymentMethodSelector } from './PaymentMethodSelector';

interface Estimate {
  id: string;
  estimateNo: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  projectTitle: string | null;
  totalAmount: number;
  status: string;
  notes: string | null;
  convertedSaleId: string | null;
  createdAt: string;
  items: EstimateItem[];
}

interface EstimateItem {
  id?: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Product {
  id: string;
  name: string;
  brand: string;
  sellPrice: number;
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; icon: typeof FileText }> = {
  draft: { label: 'Draft', color: 'text-gray-700', bg: 'bg-gray-100', icon: FileEdit },
  sent: { label: 'Sent', color: 'text-blue-700', bg: 'bg-blue-50', icon: FileText },
  accepted: { label: 'Accepted', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  converted: { label: 'Converted', color: 'text-violet-700', bg: 'bg-violet-50', icon: FileCheck },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50', icon: X },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatBDT(n: number): string {
  return `\u09F3${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function CCTVEstimates() {
  const { goBack, navigate, contextId } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const businessName = useAuthStore((s) => s.session?.business?.name || 'CCTV Shop');
  const { toast } = useToast();

  const [view, setView] = useState<'list' | 'editor' | 'detail' | 'convert'>('list');
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  // Convert state
  const [convertingEstimate, setConvertingEstimate] = useState<Estimate | null>(null);
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Detail view state
  const [detailEstimate, setDetailEstimate] = useState<Estimate | null>(null);

  const loadEstimates = () => {
    if (!businessId) return;
    setLoading(true);
    fetch(`/api/businesses/${businessId}/cctv/estimates`)
      .then((r) => r.json())
      .then((data) => {
        setEstimates(data.estimates || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const loadCustomers = () => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/customers`)
      .then((r) => r.json())
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  const loadProducts = () => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/products?limit=100`)
      .then((r) => r.json())
      .then((data) => setProducts(data.products || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadEstimates();
    loadCustomers();
    loadProducts();
  }, [businessId]);

  // If contextId is provided, load that estimate
  useEffect(() => {
    if (contextId && estimates.length > 0) {
      const est = estimates.find((e) => e.id === contextId);
      if (est) {
        setDetailEstimate(est);
        setView('detail');
      }
    }
  }, [contextId, estimates]);

  // Product search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setShowResults(false);
      return;
    }
    const timeout = setTimeout(() => {
      setShowResults(true);
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQuery, products]);

  const searchResults = searchQuery.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  const addProductToItems = (product: Product) => {
    const existing = items.find((i) => i.productId === product.id);
    if (existing) {
      setItems(items.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems([...items, {
        productId: product.id,
        productName: `${product.name} (${product.brand})`,
        quantity: 1,
        unitPrice: product.sellPrice,
      }]);
    }
    setSearchQuery('');
    setShowResults(false);
  };

  const addCustomItem = () => {
    setItems([...items, {
      productName: '',
      quantity: 1,
      unitPrice: 0,
    }]);
  };

  const updateItem = (index: number, updates: Partial<EstimateItem>) => {
    setItems(items.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  const startNew = () => {
    setEditingId(null);
    setSelectedCustomer(null);
    setProjectTitle('');
    setNotes('');
    setItems([]);
    setView('editor');
  };

  const startEdit = (estimate: Estimate) => {
    setEditingId(estimate.id);
    setSelectedCustomer({ id: estimate.customerId || '', name: estimate.customerName || '', phone: estimate.customerPhone || '' });
    setProjectTitle(estimate.projectTitle || '');
    setNotes(estimate.notes || '');
    setItems(estimate.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      notes: i.notes,
    })));
    setView('editor');
  };

  const handleSave = async () => {
    if (items.length === 0) {
      toast({ title: 'Error', description: 'Add at least one item', variant: 'destructive' });
      return;
    }
    // Validate items have names
    for (const item of items) {
      if (!item.productName.trim()) {
        toast({ title: 'Error', description: 'All items must have a name', variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || null,
        customerPhone: selectedCustomer?.phone || null,
        projectTitle: projectTitle || null,
        notes: notes || null,
        status: 'draft',
        items: items.map((i) => ({
          productId: i.productId || null,
          productName: i.productName,
          quantity: String(i.quantity),
          unitPrice: String(i.unitPrice),
          notes: i.notes || null,
        })),
      };

      const url = editingId
        ? `/api/businesses/${businessId}/cctv/estimates/${editingId}`
        : `/api/businesses/${businessId}/cctv/estimates`;
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: editingId ? 'Estimate updated' : 'Estimate created' });
        loadEstimates();
        setView('list');
        // Reset
        setEditingId(null);
        setSelectedCustomer(null);
        setProjectTitle('');
        setNotes('');
        setItems([]);
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

  const handleConvert = async () => {
    if (!convertingEstimate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/estimates/${convertingEstimate.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paidAmount: parseFloat(paidAmount) || 0,
          paymentMethod,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Converted to invoice',
          description: `Sale created for ${formatBDT(convertingEstimate.totalAmount)}`,
        });
        setConvertingEstimate(null);
        setPaidAmount('0');
        loadEstimates();
        setView('list');
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

  const handleStatusUpdate = async (estimateId: string, status: string) => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/estimates/${estimateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast({ title: `Marked as ${status}` });
        loadEstimates();
        if (detailEstimate?.id === estimateId) {
          setDetailEstimate({ ...detailEstimate, status });
        }
      }
    } catch {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const handleDelete = async (estimateId: string) => {
    if (!confirm('Delete this estimate? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/estimates/${estimateId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Estimate deleted' });
        loadEstimates();
        if (detailEstimate?.id === estimateId) {
          setView('list');
          setDetailEstimate(null);
        }
      }
    } catch {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const handlePrint = () => window.print();

  // ─── CONVERT VIEW ───
  if (view === 'convert' && convertingEstimate) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => { setView('list'); setConvertingEstimate(null); }}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Convert to Invoice</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
              {convertingEstimate.estimateNo}
            </span>
            {convertingEstimate.projectTitle && (
              <p className="text-sm font-semibold text-gray-900 truncate">{convertingEstimate.projectTitle}</p>
            )}
          </div>
          {convertingEstimate.customerName && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <User className="w-3 h-3" /> {convertingEstimate.customerName}
              {convertingEstimate.customerPhone && ` · ${convertingEstimate.customerPhone}`}
            </p>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-600">Estimate Total</span>
            <span className="text-2xl font-bold text-violet-600">{formatBDT(convertingEstimate.totalAmount)}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Amount Paid Now (৳)</Label>
            <Input type="number" value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="h-10 rounded-xl" min="0" step="0.01" />
            <p className="text-[10px] text-gray-400">
              Due after conversion: ৳{Math.max(0, convertingEstimate.totalAmount - (parseFloat(paidAmount) || 0)).toLocaleString()}
            </p>
          </div>

          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            label="Payment Method"
          />

          <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700">
            Converting will create a real invoice, decrement product stock, and mark this estimate as converted.
            The estimate cannot be edited after conversion.
          </div>
        </div>

        <button onClick={handleConvert} disabled={saving}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileCheck className="w-4 h-4" />}
          {saving ? 'Converting...' : 'Convert to Invoice'}
        </button>
      </motion.div>
    );
  }

  // ─── DETAIL VIEW ───
  if (view === 'detail' && detailEstimate) {
    const status = STATUS_STYLES[detailEstimate.status] || STATUS_STYLES.draft;
    const StatusIcon = status.icon;
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1 print:hidden">
          <button onClick={() => { setView('list'); setDetailEstimate(null); navigate('estimates'); }}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex-1">Estimate</h1>
          <span className={cn('px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5', status.bg, status.color)}>
            <StatusIcon className="w-3.5 h-3.5" /> {status.label}
          </span>
          <button onClick={handlePrint}
            className="h-9 px-4 rounded-xl bg-white border border-gray-200 text-xs font-semibold flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>

        {/* Printable Estimate */}
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 p-6 shadow-sm print:border-2 print:border-black print:rounded-none">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-gray-200 pb-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{businessName}</h2>
              <p className="text-xs text-gray-500">ESTIMATE</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-mono font-bold text-violet-600">{detailEstimate.estimateNo}</p>
              <p className="text-xs text-gray-500">{formatDate(detailEstimate.createdAt)}</p>
            </div>
          </div>

          {/* Customer + project */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-[10px] text-gray-500 font-medium uppercase">Customer</p>
              <p className="text-sm font-semibold text-gray-900">{detailEstimate.customerName || 'Walk-in'}</p>
              {detailEstimate.customerPhone && <p className="text-xs text-gray-500">{detailEstimate.customerPhone}</p>}
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-medium uppercase">Project</p>
              <p className="text-sm font-semibold text-gray-900">{detailEstimate.projectTitle || '—'}</p>
            </div>
          </div>

          {/* Items table */}
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-semibold text-gray-700">Item</th>
                <th className="text-center py-2 font-semibold text-gray-700">Qty</th>
                <th className="text-right py-2 font-semibold text-gray-700">Price</th>
                <th className="text-right py-2 font-semibold text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {detailEstimate.items.map((item, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 text-gray-800">{item.productName}</td>
                  <td className="py-2 text-center text-gray-600">{item.quantity}</td>
                  <td className="py-2 text-right text-gray-600">{formatBDT(item.unitPrice)}</td>
                  <td className="py-2 text-right font-semibold text-gray-900">{formatBDT(item.unitPrice * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td colSpan={3} className="py-3 text-right font-bold text-gray-800">Total</td>
                <td className="py-3 text-right text-xl font-bold text-violet-600">{formatBDT(detailEstimate.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>

          {detailEstimate.notes && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-[10px] text-gray-500 font-medium uppercase">Notes</p>
              <p className="text-xs text-gray-700">{detailEstimate.notes}</p>
            </div>
          )}

          <p className="text-[9px] text-gray-400 text-center mt-4 print:mt-2">
            This is an estimate, not an invoice. Prices may change. Valid for 30 days.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2 print:hidden">
          {detailEstimate.status === 'draft' && (
            <>
              <button
                onClick={() => handleStatusUpdate(detailEstimate.id, 'sent')}
                className="w-full h-11 rounded-xl bg-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" /> Mark as Sent to Client
              </button>
              <button
                onClick={() => handleStatusUpdate(detailEstimate.id, 'accepted')}
                className="w-full h-11 rounded-xl bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Mark as Accepted
              </button>
            </>
          )}
          {detailEstimate.status === 'sent' && (
            <button
              onClick={() => handleStatusUpdate(detailEstimate.id, 'accepted')}
              className="w-full h-11 rounded-xl bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Mark as Accepted
            </button>
          )}
          {(detailEstimate.status === 'accepted' || detailEstimate.status === 'sent') && (
            <button
              onClick={() => { setConvertingEstimate(detailEstimate); setView('convert'); setPaidAmount('0'); }}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg flex items-center justify-center gap-2 active:scale-95"
            >
              <FileCheck className="w-5 h-5" /> Convert to Invoice
            </button>
          )}
          {detailEstimate.status !== 'converted' && (
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(detailEstimate)}
                className="flex-1 h-11 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <FileEdit className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => handleDelete(detailEstimate.id)}
                className="flex-1 h-11 rounded-xl bg-white border border-red-200 text-red-600 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
          {detailEstimate.status === 'converted' && (
            <div className="bg-violet-50 rounded-xl p-3 text-xs text-violet-700 text-center">
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              Converted to invoice. Sale ID: {detailEstimate.convertedSaleId?.slice(-8)}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // ─── EDITOR VIEW ───
  if (view === 'editor') {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => setView('list')} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Estimate' : 'New Estimate'}</h1>
        </div>

        {/* Customer + Project */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
          <div>
            <Label className="text-xs text-gray-600 mb-2 block">Customer</Label>
            {selectedCustomer ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{selectedCustomer.name}</p>
                  <p className="text-xs text-gray-500">{selectedCustomer.phone || 'No phone'}</p>
                </div>
                <button onClick={() => setSelectedCustomer(null)}
                  className="w-8 h-8 rounded-lg hover:bg-blue-100 flex items-center justify-center shrink-0">
                  <X className="w-4 h-4 text-blue-400" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustomerDialog(true)}
                className="w-full h-10 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium hover:border-violet-300 hover:text-violet-600 transition-colors flex items-center justify-center gap-1.5"
              >
                <User className="w-4 h-4" /> Select Customer (optional)
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Project Title</Label>
            <Input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="e.g. 6-camera CCTV installation at home" className="h-10 rounded-xl text-sm" />
          </div>
        </div>

        <QuickPartyDialog
          type="customer"
          open={showCustomerDialog}
          onClose={() => setShowCustomerDialog(false)}
          existingParties={customers}
          onSelect={(c) => {
            setSelectedCustomer(c);
            loadCustomers();
          }}
        />

        {/* Add products */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <Label className="text-xs text-gray-600 mb-2 block">Add Products (no serial needed)</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product to add..." className="h-10 rounded-xl pl-10 text-sm" />
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((p) => (
                  <button key={p.id} onClick={() => addProductToItems(p)}
                    className="w-full text-left p-3 hover:bg-violet-50 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.brand} · {formatBDT(p.sellPrice)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={addCustomItem}
            className="mt-2 w-full h-9 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-xs font-medium hover:border-violet-300 hover:text-violet-600 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Custom Item (free text)
          </button>
        </div>

        {/* Items list */}
        {items.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-gray-800">Items ({items.length})</h2>
            {items.map((item, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Input value={item.productName}
                    onChange={(e) => updateItem(index, { productName: e.target.value })}
                    placeholder="Item name..."
                    className="flex-1 h-9 rounded-lg text-sm" />
                  <button onClick={() => removeItem(index)}
                    className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center shrink-0 mt-1">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium">Quantity</label>
                    <Input type="number" value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value) || 1 })}
                      className="h-9 rounded-lg text-sm" min="1" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium">Unit Price (৳)</label>
                    <Input type="number" value={item.unitPrice}
                      onChange={(e) => updateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                      className="h-9 rounded-lg text-sm" min="0" step="0.01" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Line total</span>
                  <span className="font-semibold text-gray-900">{formatBDT(item.unitPrice * item.quantity)}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm font-bold text-gray-800">Total</span>
              <span className="text-xl font-bold text-violet-600">{formatBDT(totalAmount)}</span>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-1.5">
          <Label className="text-xs text-gray-600">Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes for this estimate..." className="rounded-xl resize-none" rows={2} />
        </div>

        {/* Save */}
        {items.length > 0 && (
          <button onClick={handleSave} disabled={saving}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : (editingId ? 'Update Estimate' : 'Save Estimate')}
          </button>
        )}
      </motion.div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Estimates</h1>
        <button onClick={startNew}
          className="h-9 px-4 rounded-xl bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform">
          <Plus className="w-4 h-4" /> New Estimate
        </button>
      </div>

      <p className="text-xs text-gray-500 px-1">
        Create project estimates for clients. Add products, agree on price, then convert to a real invoice.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : estimates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No estimates yet</p>
          <p className="text-xs text-gray-400 mt-1">Tap "New Estimate" to create a project quotation</p>
        </div>
      ) : (
        <div className="space-y-2">
          {estimates.map((est) => {
            const status = STATUS_STYLES[est.status] || STATUS_STYLES.draft;
            const StatusIcon = status.icon;
            return (
              <button
                key={est.id}
                onClick={() => { setDetailEstimate(est); setView('detail'); }}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:bg-violet-50/30 transition-colors text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                        {est.estimateNo}
                      </span>
                      <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-0.5', status.bg, status.color)}>
                        <StatusIcon className="w-2.5 h-2.5" /> {status.label}
                      </span>
                    </div>
                    {est.projectTitle && (
                      <p className="text-sm font-semibold text-gray-900 mt-1 truncate">{est.projectTitle}</p>
                    )}
                    {est.customerName && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <User className="w-2.5 h-2.5" /> {est.customerName}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">{est.items.length} items</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-violet-600">{formatBDT(est.totalAmount)}</p>
                    <p className="text-[10px] text-gray-400">{formatDate(est.createdAt)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
