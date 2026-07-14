'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Printer, Shield, ShieldCheck, ShieldX,
  Phone, User, Package, Wrench, Camera,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

interface RepairDetail {
  id: string;
  tokenNo: string | null;
  serialNumber: string;
  productName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  issue: string;
  status: string;
  underWarranty: boolean;
  warrantyExpiryDate: string | null;
  receivedDate: string;
  repairStartDate: string | null;
  readyDate: string | null;
  returnedDate: string | null;
  repairNotes: string | null;
  repairCost: number;
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function CCTVRepairToken() {
  const { goBack, contextId } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const businessName = useAuthStore((s) => s.session?.business?.name || 'CCTV Shop');
  const businessPhone = useAuthStore((s) => s.session?.business?.phone || '');
  const businessAddress = useAuthStore((s) => s.session?.business?.address || '');

  const [repair, setRepair] = useState<RepairDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId || !contextId) return;
    fetch(`/api/businesses/${businessId}/cctv/repairs/${contextId}`)
      .then((r) => r.json())
      .then((data) => {
        setRepair(data.repair);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [businessId, contextId]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!repair) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-500">Repair not found</p>
      </div>
    );
  }

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header — hidden on print */}
      <div className="flex items-center gap-3 pt-1 print:hidden">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Repair Token</h1>
        <button
          onClick={handlePrint}
          className="ml-auto h-9 px-4 rounded-xl bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Printer className="w-4 h-4" /> Print Token
        </button>
      </div>

      {/* Printable Token */}
      <div className="max-w-md mx-auto bg-white rounded-2xl border-2 border-dashed border-gray-300 p-6 print:border-2 print:border-black print:rounded-none print:max-w-none print:p-4">
        {/* Shop header */}
        <div className="text-center border-b-2 border-gray-200 pb-3 mb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{businessName}</h2>
          </div>
          {businessPhone && <p className="text-xs text-gray-600">Phone: {businessPhone}</p>}
          {businessAddress && <p className="text-xs text-gray-600">{businessAddress}</p>}
        </div>

        {/* Token title */}
        <div className="text-center mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Repair Token</p>
          <p className="text-3xl font-mono font-bold text-violet-600 mt-1">{repair.tokenNo}</p>
        </div>

        {/* Warranty status banner */}
        <div className={cn(
          'rounded-xl p-3 mb-4 flex items-center gap-3 border',
          repair.underWarranty
            ? 'bg-emerald-50 border-emerald-300'
            : 'bg-gray-50 border-gray-300'
        )}>
          {repair.underWarranty ? (
            <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
          ) : (
            <ShieldX className="w-8 h-8 text-gray-500 shrink-0" />
          )}
          <div>
            <p className={cn(
              'text-sm font-bold',
              repair.underWarranty ? 'text-emerald-700' : 'text-gray-700'
            )}>
              {repair.underWarranty ? 'Under Warranty — FREE' : 'Out of Warranty — PAID'}
            </p>
            {repair.warrantyExpiryDate && (
              <p className="text-[10px] text-gray-600">
                Warranty {repair.underWarranty ? 'valid until' : 'expired on'} {formatDate(repair.warrantyExpiryDate)}
              </p>
            )}
          </div>
        </div>

        {/* Customer info */}
        <div className="space-y-2 mb-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-1">
            Customer
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-semibold text-gray-900">{repair.customerName || 'Walk-in Customer'}</span>
          </div>
          {repair.customerPhone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-700">{repair.customerPhone}</span>
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="space-y-2 mb-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-1">
            Product
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <Package className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-semibold text-gray-900">{repair.productName || 'Unknown Product'}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Serial: </span>
            <span className="font-mono font-semibold text-gray-900 break-all">{repair.serialNumber}</span>
          </div>
        </div>

        {/* Issue */}
        <div className="space-y-2 mb-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-1">
            Issue Reported
          </h3>
          <p className="text-sm text-gray-700">{repair.issue}</p>
        </div>

        {/* Repair info */}
        <div className="space-y-2 mb-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-1">
            Repair Details
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-500">Received:</p>
              <p className="font-semibold text-gray-900">{formatDateTime(repair.receivedDate)}</p>
            </div>
            <div>
              <p className="text-gray-500">Status:</p>
              <p className="font-semibold text-gray-900 uppercase">{repair.status.replace(/_/g, ' ')}</p>
            </div>
            {repair.repairCost > 0 && (
              <div className="col-span-2">
                <p className="text-gray-500">Repair Cost:</p>
                <p className="text-lg font-bold text-violet-600">৳{repair.repairCost.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer — claim instructions */}
        <div className="border-t-2 border-dashed border-gray-300 pt-3 mt-4">
          <div className="bg-violet-50 rounded-lg p-2 mb-2">
            <p className="text-[10px] text-violet-700 font-semibold text-center">
              Keep this token safe. Present it when collecting your product.
            </p>
          </div>
          <p className="text-[9px] text-gray-500 text-center">
            Call {businessPhone || 'us'} with token number <span className="font-mono font-bold">{repair.tokenNo}</span> to check status.
          </p>
          <p className="text-[9px] text-gray-400 text-center mt-1">
            Token generated: {formatDateTime(repair.receivedDate)}
          </p>
        </div>
      </div>

      {/* Helper text — hidden on print */}
      <p className="text-center text-xs text-gray-400 print:hidden">
        Tap "Print Token" to print or save as PDF. Cut along the dashed line and give to customer.
      </p>
    </motion.div>
  );
}
