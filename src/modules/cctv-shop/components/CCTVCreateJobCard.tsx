'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, Search, Camera, X, Hash, ChevronDown,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { JobType, JobPriority } from '@/modules/cctv-shop/types';

const BUSINESS_ID = 'bus_placeholder';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

const JOB_TYPES: { value: JobType; label: string; icon: string }[] = [
  { value: 'REPAIR', label: 'Repair', icon: '⚡' },
  { value: 'INSTALLATION', label: 'Installation', icon: '🔧' },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: '🛠️' },
  { value: 'DIAGNOSTIC', label: 'Diagnostic', icon: '🔬' },
];

const PRIORITIES: { value: JobPriority; label: string; color: string; ring: string }[] = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-100 text-gray-600', ring: 'ring-gray-300' },
  { value: 'NORMAL', label: 'Normal', color: 'bg-blue-100 text-blue-700', ring: 'ring-blue-400' },
  { value: 'HIGH', label: 'High', color: 'bg-amber-100 text-amber-700', ring: 'ring-amber-400' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-100 text-red-700', ring: 'ring-red-400' },
];

interface SerialItemResult {
  id: string;
  serialNumber: string;
  imei?: string;
  status: string;
  grade?: string;
  product?: { id: string; name: string; brand: string; imageUrl?: string | null };
}

function SectionHeader({ title, icon }: { title: string; icon?: string }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-3 first:mt-0">
      {icon && <span className="text-sm">{icon}</span>}
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
    </div>
  );
}

export function CCTVCreateJobCard() {
  const { navigate, goBack, contextId } = useCCTVNavStore();
  const { toast } = useToast();

  // Form state
  const [jobType, setJobType] = useState<JobType>('REPAIR');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serialItemId, setSerialItemId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [imei, setImei] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [photoUrlsText, setPhotoUrlsText] = useState('');
  const [reportedFault, setReportedFault] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [priority, setPriority] = useState<JobPriority>('NORMAL');
  const [assignedToName, setAssignedToName] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Serial item search
  const [serialSearch, setSerialSearch] = useState('');
  const [serialResults, setSerialResults] = useState<SerialItemResult[]>([]);
  const [serialSearching, setSerialSearching] = useState(false);
  const [showSerialDropdown, setShowSerialDropdown] = useState(false);
  const [linkDevice, setLinkDevice] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Pre-fill from contextId (serial item)
  useEffect(() => {
    if (!contextId) return;
    (async () => {
      try {
        const res = await fetch(`/api/businesses/${BUSINESS_ID}/cctv/serial-items/${contextId}`);
        if (res.ok) {
          const item = await res.json();
          setSerialItemId(item.id);
          setDeviceName(item.product ? `${item.product.brand || ''} ${item.product.name || ''}`.trim() : '');
          setSerialNumber(item.serialNumber || '');
          setImei(item.imei || '');
          setLinkDevice(true);
        }
      } catch {}
    })();
  }, [contextId]);

  // Debounced serial item search
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    if (!serialSearch || serialSearch.length < 2) return;
    const timer = setTimeout(async () => {
      abortRef.current = new AbortController();
      setSerialSearching(true);
      try {
        const res = await fetch(
          `/api/businesses/${BUSINESS_ID}/cctv/serial-items?search=${encodeURIComponent(serialSearch)}&status=IN_STOCK&limit=10`,
          { signal: abortRef.current.signal },
        );
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data.items || [];
          setSerialResults(items);
          setShowSerialDropdown(items.length > 0);
        }
      } catch {
        // aborted
      }
      setSerialSearching(false);
    }, 300);
    return () => { clearTimeout(timer); setSerialResults([]); setShowSerialDropdown(false); };
  }, [serialSearch]);

  const selectSerialItem = (item: SerialItemResult) => {
    setSerialItemId(item.id);
    setDeviceName(item.product ? `${item.product.brand || ''} ${item.product.name || ''}`.trim() : '');
    setSerialNumber(item.serialNumber || '');
    setImei(item.imei || '');
    setSerialSearch('');
    setShowSerialDropdown(false);
  };

  const unlinkDevice = () => {
    setSerialItemId(null);
    setDeviceName('');
    setSerialNumber('');
    setImei('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !reportedFault.trim()) {
      toast({ title: 'Missing required fields', description: 'Customer name, phone, and fault description are required.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // Parse photo URLs
      let photoUrls: string | null = null;
      if (photoUrlsText.trim()) {
        const urls = photoUrlsText.split('\n').map((u) => u.trim()).filter(Boolean);
        if (urls.length > 0) photoUrls = JSON.stringify(urls);
      }

      const body: Record<string, unknown> = {
        jobType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        reportedFault: reportedFault.trim(),
        priority,
      };
      if (serialItemId) body.serialItemId = serialItemId;
      if (deviceName.trim()) body.deviceName = deviceName.trim();
      if (serialNumber.trim()) body.serialNumber = serialNumber.trim();
      if (imei.trim()) body.imei = imei.trim();
      if (conditionNotes.trim()) body.conditionNotes = conditionNotes.trim();
      if (photoUrls) body.photoUrls = photoUrls;
      if (estimatedCost.trim()) body.estimatedCost = Number(estimatedCost);
      if (assignedToName.trim()) body.assignedToName = assignedToName.trim();
      if (internalNotes.trim()) body.internalNotes = internalNotes.trim();

      const res = await fetch(`/api/businesses/${BUSINESS_ID}/cctv/job-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const created = await res.json();
        toast({ title: 'Job card created', description: `${created.jobCode} — ${created.customerName}` });
        navigate('job-card-detail', created.id);
      } else {
        const err = await res.json();
        toast({ title: 'Failed to create', description: err.error || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' });
    }
    setLoading(false);
  };

  const isFormValid = customerName.trim() && customerPhone.trim() && reportedFault.trim();

  return (
    <motion.div {...fadeUp} className="pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1 mb-4">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">New Job Card</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-1">
        {/* Job Type */}
        <SectionHeader title="Job Type" icon="📋" />
        <div className="grid grid-cols-2 gap-2">
          {JOB_TYPES.map((jt) => (
            <button
              key={jt.value}
              type="button"
              onClick={() => setJobType(jt.value)}
              className={cn(
                'flex items-center gap-2.5 px-3.5 py-3 rounded-xl border-2 text-left transition-all',
                jobType === jt.value
                  ? 'border-violet-500 bg-violet-50 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-gray-200',
              )}
            >
              <span className="text-lg">{jt.icon}</span>
              <span className={cn(
                'text-sm font-semibold',
                jobType === jt.value ? 'text-violet-700' : 'text-gray-600',
              )}>
                {jt.label}
              </span>
            </button>
          ))}
        </div>

        {/* Priority */}
        <SectionHeader title="Priority" icon="🚨" />
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(p.value)}
              className={cn(
                'flex-1 py-2 rounded-xl text-xs font-semibold transition-all border-2',
                priority === p.value
                  ? cn(p.color, 'border-current ring-2', p.ring, 'ring-offset-1')
                  : 'bg-white border-gray-100 text-gray-400',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Customer Information */}
        <SectionHeader title="Customer Information" icon="👤" />
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Customer Name <span className="text-red-400">*</span>
            </label>
            <Input
              placeholder="Full name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Phone Number <span className="text-red-400">*</span>
            </label>
            <Input
              placeholder="01XXXXXXXXX"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="h-10 rounded-xl"
              type="tel"
            />
          </div>
        </div>

        {/* Device */}
        <SectionHeader title="Device" icon="📦" />
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          {/* Link device toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-semibold text-gray-700">Link Serial Item</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (linkDevice) unlinkDevice();
                else setLinkDevice(true);
              }}
              className={cn(
                'text-xs font-semibold px-3 py-1.5 rounded-full transition-all',
                linkDevice
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-gray-100 text-gray-500',
              )}
            >
              {linkDevice ? 'Linked' : 'Link'}
            </button>
          </div>

          {linkDevice && !serialItemId && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by serial number, IMEI..."
                value={serialSearch}
                onChange={(e) => setSerialSearch(e.target.value)}
                onFocus={() => serialResults.length > 0 && setShowSerialDropdown(true)}
                className="pl-10 pr-10 h-10 rounded-xl"
              />
              {serialSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-500 animate-spin" />}
              {!serialSearching && serialSearch && (
                <button
                  type="button"
                  onClick={() => { setSerialSearch(''); setSerialResults([]); setShowSerialDropdown(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}

              {/* Dropdown */}
              <AnimatePresence>
                {showSerialDropdown && serialResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-lg max-h-48 overflow-y-auto"
                  >
                    {serialResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectSerialItem(item)}
                        className="w-full text-left px-3 py-2.5 hover:bg-violet-50 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {item.product ? `${item.product.brand} ${item.product.name}` : 'Unknown Product'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-gray-500">SN: {item.serialNumber}</span>
                          {item.imei && (
                            <span className="text-[11px] font-mono text-gray-400">IMEI: {item.imei}</span>
                          )}
                          <span className="text-[10px] text-emerald-600 font-medium">{item.status}</span>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {serialItemId && (
            <div className="bg-violet-50 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-violet-700">Device Linked</span>
                <button
                  type="button"
                  onClick={unlinkDevice}
                  className="text-xs text-red-500 font-medium hover:text-red-600"
                >
                  Unlink
                </button>
              </div>
              {deviceName && <p className="text-sm font-medium text-gray-800">{deviceName}</p>}
              {serialNumber && (
                <p className="text-xs font-mono text-gray-500">SN: {serialNumber}</p>
              )}
              {imei && (
                <p className="text-xs font-mono text-gray-500">IMEI: {imei}</p>
              )}
            </div>
          )}

          {/* Manual device fields */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Device Name</label>
            <Input
              placeholder="e.g., Hikvision DS-2CD2143G2"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="h-10 rounded-xl"
              readOnly={!!serialItemId}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Serial Number</label>
              <Input
                placeholder="Serial #"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="h-10 rounded-xl font-mono text-sm"
                readOnly={!!serialItemId}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">IMEI</label>
              <Input
                placeholder="IMEI #"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                className="h-10 rounded-xl font-mono text-sm"
                readOnly={!!serialItemId}
              />
            </div>
          </div>
        </div>

        {/* Condition at Intake */}
        <SectionHeader title="Condition at Intake" icon="📸" />
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Camera className="w-3.5 h-3.5 text-gray-400" />
              <label className="text-xs font-medium text-gray-500">Condition Notes</label>
            </div>
            <Textarea
              placeholder="Pre-existing scratches, dents, screen cracks..."
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              className="min-h-[72px] text-sm rounded-xl resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Photo URLs</label>
            <Textarea
              placeholder="One URL per line"
              value={photoUrlsText}
              onChange={(e) => setPhotoUrlsText(e.target.value)}
              className="min-h-[56px] text-sm rounded-xl resize-none font-mono"
              rows={2}
            />
            <p className="text-[10px] text-gray-400 mt-1">Document physical condition with photos. One URL per line.</p>
          </div>
        </div>

        {/* Fault & Cost */}
        <SectionHeader title="Fault & Cost" icon="🔧" />
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Reported Fault <span className="text-red-400">*</span>
            </label>
            <Textarea
              placeholder="Customer's reported problem..."
              value={reportedFault}
              onChange={(e) => setReportedFault(e.target.value)}
              className="min-h-[80px] text-sm rounded-xl resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Estimated Cost (BDT)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">৳</span>
              <Input
                type="number"
                placeholder="0"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                className="pl-8 h-10 rounded-xl"
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Assignment & Notes */}
        <SectionHeader title="Assignment & Notes" icon="📝" />
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Assigned Technician</label>
            <Input
              placeholder="Technician name"
              value={assignedToName}
              onChange={(e) => setAssignedToName(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Internal Notes</label>
            <Textarea
              placeholder="Notes not visible to customer..."
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="min-h-[64px] text-sm rounded-xl resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 pb-2">
          <Button
            type="submit"
            disabled={loading || !isFormValid}
            className={cn(
              'w-full h-12 rounded-2xl text-sm font-bold shadow-lg transition-all',
              'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-violet-500/20',
              'hover:shadow-violet-500/30 active:scale-[0.98]',
              (loading || !isFormValid) && 'opacity-60 pointer-events-none',
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </span>
            ) : (
              'Create Job Card'
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}