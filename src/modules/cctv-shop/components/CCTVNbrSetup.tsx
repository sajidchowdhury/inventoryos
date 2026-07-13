'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Building,
  FileText,
  Hash,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Shield,
  ToggleLeft,
  ToggleRight,
  Search,
  Edit3,
  X,
  Sparkles,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import type { CCTVNbrConfig, CCTVHsCodeMapping, TaxRegistrationStatus } from '../types';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

const REGISTRATION_OPTIONS: { value: TaxRegistrationStatus; label: string; desc: string }[] = [
  { value: 'UNREGISTERED', label: 'Unregistered', desc: 'Not registered with NBR' },
  { value: 'REGISTERED', label: 'Registered', desc: 'Has a valid BIN from NBR' },
  { value: 'EXEMPT', label: 'Tax Exempt', desc: 'Exempt from VAT (e.g. small business)' },
];

export function CCTVNbrSetup() {
  const { goBack } = useCCTVNavStore();
  const businessId = useCctvBusinessId();
  const [config, setConfig] = useState<CCTVNbrConfig | null>(null);
  const [hsCodes, setHsCodes] = useState<CCTVHsCodeMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Edit form state
  const [bin, setBin] = useState('');
  const [taxStatus, setTaxStatus] = useState<TaxRegistrationStatus>('UNREGISTERED');
  const [vatRate, setVatRate] = useState('15');
  const [invoicePrefix, setInvoicePrefix] = useState('MUSHAK');
  const [legalName, setLegalName] = useState('');
  const [legalAddress, setLegalAddress] = useState('');
  const [tradeLicense, setTradeLicense] = useState('');
  const [vatEnabled, setVatEnabled] = useState(false);
  const [autoMushak, setAutoMushak] = useState(false);

  // HS code management
  const [hsSearch, setHsSearch] = useState('');
  const [showAddHs, setShowAddHs] = useState(false);
  const [editingHs, setEditingHs] = useState<CCTVHsCodeMapping | null>(null);
  const [hsForm, setHsForm] = useState({ category: '', hsCode: '', description: '', vatRate: '15' });
  const [hsExpanded, setHsExpanded] = useState(true);

  // Section collapse
  const [sections, setSections] = useState({ bin: true, invoice: true, hsCodes: true, flags: true });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/nbr-config`);
      const json = await res.json();
      if (json.success) {
        const c: CCTVNbrConfig = json.data;
        setConfig(c);
        setBin(c.bin || '');
        setTaxStatus(c.taxRegistrationStatus);
        setVatRate(String(c.applicableVatRate));
        setInvoicePrefix(c.mushakInvoicePrefix);
        setLegalName(c.legalName || '');
        setLegalAddress(c.legalAddress || '');
        setTradeLicense(c.tradeLicenseNo || '');
        setVatEnabled(c.isVatEnabled);
        setAutoMushak(c.autoMushakInvoice);
        setHsCodes(c.hsCodeMappings || []);
      }
    } catch (err) {
      console.error('Load config error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/nbr-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bin: bin.trim() || null,
          taxRegistrationStatus: taxStatus,
          applicableVatRate: parseFloat(vatRate) || 15,
          mushakInvoicePrefix: invoicePrefix.trim() || 'MUSHAK',
          legalName: legalName.trim() || null,
          legalAddress: legalAddress.trim() || null,
          tradeLicenseNo: tradeLicense.trim() || null,
          isVatEnabled: vatEnabled,
          autoMushakInvoice: autoMushak,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('NBR configuration saved');
        loadConfig();
      } else {
        showToast(json.error || 'Save failed');
      }
    } catch {
      showToast('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHs = async () => {
    if (!hsForm.category.trim() || !hsForm.hsCode.trim()) {
      showToast('Category and HS Code are required');
      return;
    }
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/nbr-config/hs-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: hsForm.category.trim(),
          hsCode: hsForm.hsCode.trim(),
          description: hsForm.description.trim() || null,
          vatRate: parseFloat(hsForm.vatRate) || 15,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setHsCodes((prev) => [...prev, json.data]);
        setHsForm({ category: '', hsCode: '', description: '', vatRate: '15' });
        setShowAddHs(false);
        showToast('HS code added');
      } else {
        showToast(json.error || 'Failed to add');
      }
    } catch {
      showToast('Network error');
    }
  };

  const handleUpdateHs = async () => {
    if (!editingHs) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/nbr-config/hs-codes/${editingHs.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: hsForm.category.trim(),
          hsCode: hsForm.hsCode.trim(),
          description: hsForm.description.trim() || null,
          vatRate: parseFloat(hsForm.vatRate) || 15,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setHsCodes((prev) => prev.map((h) => (h.id === editingHs.id ? json.data : h)));
        setEditingHs(null);
        setHsForm({ category: '', hsCode: '', description: '', vatRate: '15' });
        showToast('HS code updated');
      } else {
        showToast(json.error || 'Update failed');
      }
    } catch {
      showToast('Network error');
    }
  };

  const handleDeleteHs = async (id: string) => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/nbr-config/hs-codes/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setHsCodes((prev) => prev.filter((h) => h.id !== id));
        showToast('HS code removed');
      }
    } catch {
      showToast('Network error');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/nbr-config/seed-defaults`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        loadConfig();
        showToast(json.message);
      }
    } catch {
      showToast('Network error');
    }
  };

  const openEditHs = (h: CCTVHsCodeMapping) => {
    setEditingHs(h);
    setHsForm({ category: h.category, hsCode: h.hsCode, description: h.description || '', vatRate: String(h.vatRate) });
    setShowAddHs(true);
  };

  const cancelHsForm = () => {
    setShowAddHs(false);
    setEditingHs(null);
    setHsForm({ category: '', hsCode: '', description: '', vatRate: '15' });
  };

  const filteredHsCodes = hsSearch
    ? hsCodes.filter(
        (h) =>
          h.category.toLowerCase().includes(hsSearch.toLowerCase()) ||
          h.hsCode.includes(hsSearch) ||
          (h.description && h.description.toLowerCase().includes(hsSearch.toLowerCase())),
      )
    : hsCodes;

  const toggleSection = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isDirty =
    bin !== (config?.bin || '') ||
    taxStatus !== (config?.taxRegistrationStatus || 'UNREGISTERED') ||
    vatRate !== String(config?.applicableVatRate ?? 15) ||
    invoicePrefix !== (config?.mushakInvoicePrefix || 'MUSHAK') ||
    legalName !== (config?.legalName || '') ||
    legalAddress !== (config?.legalAddress || '') ||
    tradeLicense !== (config?.tradeLicenseNo || '') ||
    vatEnabled !== (config?.isVatEnabled ?? false) ||
    autoMushak !== (config?.autoMushakInvoice ?? false);

  const previewInvoice = `${invoicePrefix}-${String((config?.mushakInvoiceSeq ?? 0) + 1).padStart(4, '0')}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pb-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex items-center gap-3 mb-5">
        <button onClick={goBack} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">NBR & Tax Setup</h1>
          <p className="text-xs text-gray-500">BIN, VAT rate, HS codes & Mushak config</p>
        </div>
        <button
          onClick={handleSaveConfig}
          disabled={saving || !isDirty}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:shadow-none transition-all"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </motion.div>

      {/* Status Banner */}
      {config && config.taxRegistrationStatus === 'UNREGISTERED' && (
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Tax Registration Not Set</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Enter your BIN and set registration status to enable VAT calculation and Mushak invoice generation.
            </p>
          </div>
        </motion.div>
      )}

      {config && config.taxRegistrationStatus === 'REGISTERED' && (
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 mb-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">NBR Registered</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {config.bin ? `BIN: ${config.bin}` : 'BIN not entered yet'} &middot; VAT: {config.applicableVatRate}%
            </p>
          </div>
        </motion.div>
      )}

      {/* Section: Business Identification */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
        <button onClick={() => toggleSection('bin')} className="flex items-center justify-between w-full text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Building className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Business Identification</p>
              <p className="text-xs text-gray-500">BIN, legal name & trade license</p>
            </div>
          </div>
          {sections.bin ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        <AnimatePresence>
          {sections.bin && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3.5">
                {/* Tax Registration Status */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Registration Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {REGISTRATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setTaxStatus(opt.value)}
                        className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                          taxStatus === opt.value
                            ? 'border-violet-500 bg-violet-50'
                            : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                        }`}
                      >
                        <p className={`text-xs font-semibold ${taxStatus === opt.value ? 'text-violet-700' : 'text-gray-600'}`}>
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* BIN */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Business Identification Number (BIN)</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={bin}
                      onChange={(e) => setBin(e.target.value)}
                      placeholder="e.g. 123456789"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                    />
                  </div>
                </div>

                {/* Legal Name */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Registered Business Name</label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Legal name as on trade license"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                  />
                </div>

                {/* Legal Address */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Registered Address</label>
                  <textarea
                    value={legalAddress}
                    onChange={(e) => setLegalAddress(e.target.value)}
                    placeholder="Address as per NBR registration"
                    rows={2}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all resize-none"
                  />
                </div>

                {/* Trade License */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Trade License Number</label>
                  <input
                    type="text"
                    value={tradeLicense}
                    onChange={(e) => setTradeLicense(e.target.value)}
                    placeholder="e.g. TRD-12345"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Section: Tax & Invoice Settings */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
        <button onClick={() => toggleSection('invoice')} className="flex items-center justify-between w-full text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Tax & Invoice Settings</p>
              <p className="text-xs text-gray-500">VAT rate & Mushak invoice prefix</p>
            </div>
          </div>
          {sections.invoice ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        <AnimatePresence>
          {sections.invoice && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3.5">
                {/* VAT Rate */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Applicable VAT Rate (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={vatRate}
                      onChange={(e) => setVatRate(e.target.value)}
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-24 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                    />
                    <span className="text-sm text-gray-500">%</span>
                    <span className="text-xs text-gray-400 ml-auto">NBR standard: 15%</span>
                  </div>
                </div>

                {/* Invoice Prefix */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Mushak Invoice Prefix</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={invoicePrefix}
                      onChange={(e) => setInvoicePrefix(e.target.value)}
                      placeholder="MUSHAK"
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Next invoice: <span className="font-mono font-semibold text-violet-600">{previewInvoice}</span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Section: Feature Flags */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
        <button onClick={() => toggleSection('flags')} className="flex items-center justify-between w-full text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Shield className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Feature Controls</p>
              <p className="text-xs text-gray-500">Enable/disable VAT & auto-invoice</p>
            </div>
          </div>
          {sections.flags ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        <AnimatePresence>
          {sections.flags && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3">
                {/* VAT Enabled */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Enable VAT Calculation</p>
                    <p className="text-xs text-gray-500">Auto-calculate VAT on all sales</p>
                  </div>
                  <button
                    onClick={() => setVatEnabled(!vatEnabled)}
                    className="shrink-0"
                  >
                    {vatEnabled ? (
                      <ToggleRight className="w-10 h-10 text-violet-500" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-gray-300" />
                    )}
                  </button>
                </div>

                {/* Auto Mushak */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Auto-Generate Mushak 6.3</p>
                    <p className="text-xs text-gray-500">Create tax invoice on each sale</p>
                  </div>
                  <button
                    onClick={() => setAutoMushak(!autoMushak)}
                    className="shrink-0"
                  >
                    {autoMushak ? (
                      <ToggleRight className="w-10 h-10 text-violet-500" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-gray-300" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Section: HS Code Mappings */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
        <button onClick={() => toggleSection('hsCodes')} className="flex items-center justify-between w-full text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Hash className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">HS Code Mappings</p>
              <p className="text-xs text-gray-500">{hsCodes.length} categories configured</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hsExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </button>

        <AnimatePresence>
          {sections.hsCodes && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4">
                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={hsSearch}
                    onChange={(e) => setHsSearch(e.target.value)}
                    placeholder="Search category or HS code..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => { setShowAddHs(true); setEditingHs(null); setHsForm({ category: '', hsCode: '', description: '', vatRate: '15' }); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 text-xs font-semibold rounded-lg hover:bg-violet-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Custom
                  </button>
                  <button
                    onClick={handleSeedDefaults}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
                  </button>
                </div>

                {/* HS Code Add/Edit Form */}
                <AnimatePresence>
                  {showAddHs && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-violet-50 border border-violet-100 rounded-xl p-3 mb-3 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-violet-700">
                          {editingHs ? 'Edit HS Code' : 'New HS Code Mapping'}
                        </p>
                        <button onClick={cancelHsForm}><X className="w-4 h-4 text-gray-400" /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 mb-1 block">Category *</label>
                          <input
                            type="text"
                            value={hsForm.category}
                            onChange={(e) => setHsForm((f) => ({ ...f, category: e.target.value }))}
                            placeholder="e.g. Cameras"
                            className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 mb-1 block">HS Code *</label>
                          <input
                            type="text"
                            value={hsForm.hsCode}
                            onChange={(e) => setHsForm((f) => ({ ...f, hsCode: e.target.value }))}
                            placeholder="e.g. 8525.89"
                            className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-gray-500 mb-1 block">Description</label>
                        <input
                          type="text"
                          value={hsForm.description}
                          onChange={(e) => setHsForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Brief description of the product category"
                          className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 mb-1 block">VAT %</label>
                          <input
                            type="number"
                            value={hsForm.vatRate}
                            onChange={(e) => setHsForm((f) => ({ ...f, vatRate: e.target.value }))}
                            className="w-16 px-2.5 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white"
                          />
                        </div>
                        <div className="flex-1 flex justify-end pt-4">
                          <button
                            onClick={editingHs ? handleUpdateHs : handleAddHs}
                            className="px-4 py-2 bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold rounded-lg shadow-lg shadow-violet-500/20"
                          >
                            {editingHs ? 'Update' : 'Add'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* HS Code List */}
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                  {filteredHsCodes.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-6">No HS codes found</p>
                  )}
                  {filteredHsCodes.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">{h.category}</p>
                          {h.isDefault && (
                            <span className="px-1.5 py-0.5 text-[9px] font-medium bg-violet-100 text-violet-600 rounded-md">DEFAULT</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono text-violet-600 font-semibold">{h.hsCode}</span>
                          <span className="text-xs text-gray-400">{h.vatRate}%</span>
                        </div>
                        {h.description && (
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{h.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditHs(h)}
                          className="p-1.5 rounded-lg hover:bg-white transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteHs(h.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Info Card */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-violet-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-violet-800">About NBR Compliance</p>
            <p className="text-xs text-violet-600 mt-1 leading-relaxed">
              The BIN (Business Identification Number) is issued by the National Board of Revenue, Bangladesh.
              Setting up your NBR config here enables automatic VAT calculation, Mushak 6.3 tax invoice generation,
              and purchase/sales register maintenance. HS codes are pre-populated with common electronics categories
              and can be customized to match your product catalog.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}