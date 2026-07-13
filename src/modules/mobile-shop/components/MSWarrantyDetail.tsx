'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, User, Package, ShieldCheck, ShieldAlert,
  AlertTriangle, Clock, Hash, ExternalLink, Plus, Loader2,
  CheckCircle2, XCircle, Wrench, ChevronRight, RefreshCw,
  MessageSquare, FileText, Shield,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const formatBDT = (n: number | null | undefined) => {
  if (n == null) return '৳0';
  return '৳' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.2, 1] } },
};

const fadeChild = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0, 0, 0.2, 1] } },
};

interface SerialItemProduct {
  id: string;
  name: string;
  brand: string;
  warrantyMonths: number;
  sellPrice: number;
}

interface HistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  event: string;
  createdAt: string;
  notes: string | null;
}

interface SerialItem {
  id: string;
  serialNumber: string;
  imei: string | null;
  status: string;
  warrantyMonths: number;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  customerName: string | null;
  customerPhone: string | null;
  saleId: string | null;
  product: SerialItemProduct | null;
  history: HistoryEntry[];
}

type WarrantyClaimStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

interface WarrantyClaim {
  id: string;
  serialItemId: string;
  issueDescription: string;
  customerName: string;
  customerPhone: string;
  status: WarrantyClaimStatus;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

const CLAIM_STATUS_CONFIG: Record<
  WarrantyClaimStatus,
  { badge: string; label: string }
> = {
  PENDING: { badge: 'bg-amber-100 text-amber-700', label: 'Pending' },
  APPROVED: { badge: 'bg-blue-100 text-blue-700', label: 'Approved' },
  IN_PROGRESS: { badge: 'bg-cyan-100 text-cyan-700', label: 'In Progress' },
  COMPLETED: { badge: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
  REJECTED: { badge: 'bg-red-100 text-red-700', label: 'Rejected' },
  CANCELLED: { badge: 'bg-gray-100 text-gray-600', label: 'Cancelled' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

function computeWarrantyStatus(item: SerialItem): {
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';
  daysRemaining: number;
} {
  if (!item.warrantyEnd) {
    return { status: 'EXPIRED', daysRemaining: -9999 };
  }
  const end = new Date(item.warrantyEnd);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const days = Math.ceil(diffMs / 86400000);
  if (days <= 0) return { status: 'EXPIRED', daysRemaining: days };
  if (days <= 90) return { status: 'EXPIRING_SOON', daysRemaining: days };
  return { status: 'ACTIVE', daysRemaining: days };
}

export function MSWarrantyDetail() {
  const { contextId, navigate, goBack } = useMSNavStore();
  const { toast } = useToast();
  const businessId = useMSBusinessId();

  const [item, setItem] = useState<SerialItem | null>(null);
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [claimsLoading, setClaimsLoading] = useState(true);

  // New claim dialog
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [claimDescription, setClaimDescription] = useState('');
  const [claimCustomerName, setClaimCustomerName] = useState('');
  const [claimCustomerPhone, setClaimCustomerPhone] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // Complete claim dialog
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeClaimId, setCompleteClaimId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submittingComplete, setSubmittingComplete] = useState(false);

  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!contextId) return;
    setLoading(true);
    setError(false);
    setClaimsLoading(true);
    try {
      const [itemRes, claimsRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}/mobile-shop/serial-items/${contextId}`),
        fetch(`/api/businesses/${businessId}/mobile-shop/warranty-claims?serialItemId=${contextId}`),
      ]);
      if (itemRes.ok) {
        const data = await itemRes.json();
        setItem(data);
        setClaimCustomerName(data.customerName || '');
        setClaimCustomerPhone(data.customerPhone || '');
      } else {
        setError(true);
      }
      if (claimsRes.ok) {
        const data = await claimsRes.json();
        setClaims(Array.isArray(data) ? data : []);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
    setClaimsLoading(false);
  }, [contextId, businessId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!contextId || cancelled) return;
      await fetchData();
    };
    run();
    return () => { cancelled = true; };
  }, [fetchData, contextId]);

  const handleCreateClaim = async () => {
    if (!claimDescription.trim() || !contextId) return;
    setSubmittingClaim(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/mobile-shop/warranty-claims`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serialItemId: contextId,
            issueDescription: claimDescription.trim(),
            customerName: claimCustomerName.trim(),
            customerPhone: claimCustomerPhone.trim(),
          }),
        }
      );
      if (res.ok) {
        toast({ title: 'Claim submitted successfully' });
        setClaimDescription('');
        setClaimDialogOpen(false);
        fetchData();
      } else {
        toast({ title: 'Failed to submit claim', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setSubmittingClaim(false);
  };

  const updateClaimStatus = async (
    claimId: string,
    status: string,
    notes?: string
  ) => {
    setActionLoading(claimId);
    try {
      const body: Record<string, string> = { status };
      if (notes) body.resolutionNotes = notes;
      const res = await fetch(
        `/api/businesses/${businessId}/mobile-shop/warranty-claims/${claimId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) {
        toast({
          title: `Claim ${status === 'COMPLETED' ? 'completed' : status.toLowerCase()}`,
        });
        fetchData();
      } else {
        toast({
          title: 'Failed to update claim',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleCompleteClaim = async () => {
    if (!completeClaimId) return;
    setSubmittingComplete(true);
    await updateClaimStatus(completeClaimId, 'COMPLETED', resolutionNotes.trim());
    setSubmittingComplete(false);
    setCompleteDialogOpen(false);
    setResolutionNotes('');
    setCompleteClaimId(null);
  };

  const ws = item ? computeWarrantyStatus(item) : null;

  // Loading state
  if (loading) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </motion.div>
    );
  }

  // Error state
  if (error || !item) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex-1">
            Warranty Details
          </h1>
        </div>
        <div className="text-center py-16">
          <ShieldAlert className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Failed to load warranty details</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData()}
            className="mt-3 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </motion.div>
    );
  }

  const canCreateClaim =
    ws && (ws.status === 'ACTIVE' || ws.status === 'EXPIRING_SOON');

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">
          Warranty Details
        </h1>
      </div>

      {/* Warranty Status Card */}
      {ws && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{
            opacity: 1,
            scale: 1,
            transition: { duration: 0.35, ease: [0, 0, 0.2, 1] },
          }}
          className={cn(
            'rounded-2xl p-5 text-white relative overflow-hidden',
            ws.status === 'ACTIVE' &&
              'bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/20',
            ws.status === 'EXPIRING_SOON' &&
              'bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20',
            ws.status === 'EXPIRED' &&
              'bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20'
          )}
        >
          {/* Decorative circles */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/10" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              {ws.status === 'ACTIVE' && (
                <ShieldCheck className="w-7 h-7 text-white/90" />
              )}
              {ws.status === 'EXPIRING_SOON' && (
                <AlertTriangle className="w-7 h-7 text-white/90" />
              )}
              {ws.status === 'EXPIRED' && (
                <ShieldAlert className="w-7 h-7 text-white/90" />
              )}
              <div>
                <h2 className="text-lg font-bold">
                  {ws.status === 'ACTIVE' && 'Warranty Active'}
                  {ws.status === 'EXPIRING_SOON' && 'Expiring Soon'}
                  {ws.status === 'EXPIRED' && 'Warranty Expired'}
                </h2>
                {ws.status === 'EXPIRING_SOON' && (
                  <p className="text-sm text-white/80 mt-0.5">
                    {ws.daysRemaining} days remaining
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider">
                  Start Date
                </p>
                <p className="font-semibold mt-0.5">
                  {formatDate(item.warrantyStart)}
                </p>
              </div>
              <div>
                <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider">
                  End Date
                </p>
                <p className="font-semibold mt-0.5">
                  {formatDate(item.warrantyEnd)}
                </p>
              </div>
              <div>
                <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider">
                  Duration
                </p>
                <p className="font-semibold mt-0.5">
                  {item.warrantyMonths} months
                </p>
              </div>
              <div>
                <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider">
                  Days Remaining
                </p>
                <p className="font-semibold mt-0.5">
                  {ws.daysRemaining >= 0
                    ? `${ws.daysRemaining} days`
                    : `${Math.abs(ws.daysRemaining)} days ago`}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Product Info Card */}
      <motion.div
        variants={fadeChild}
        initial="initial"
        animate="animate"
        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-cyan-500" />
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Product Info
          </h3>
        </div>
        <div className="space-y-2.5">
          <div>
            <p className="text-sm font-bold text-gray-900">
              {item.product?.name || 'Unknown Product'}
            </p>
            {item.product?.brand && (
              <p className="text-xs text-gray-500">{item.product.brand}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Hash className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-mono text-gray-700">
              {item.serialNumber}
            </span>
          </div>
          {item.imei && (
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-mono text-gray-700">
                IMEI: {item.imei}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="text-[10px] font-semibold bg-gray-100 text-gray-600"
            >
              {item.status}
            </Badge>
            {item.product?.sellPrice != null && item.product.sellPrice > 0 && (
              <span className="text-xs font-bold text-gray-700">
                {formatBDT(item.product.sellPrice)}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Customer Card */}
      <motion.div
        variants={fadeChild}
        initial="initial"
        animate="animate"
        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-cyan-500" />
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Customer
          </h3>
        </div>
        {item.customerName ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">
              {item.customerName}
            </p>
            {item.customerPhone && (
              <a
                href={`tel:${item.customerPhone.replace(/[^0-9+]/g, '')}`}
                className="flex items-center gap-2 text-sm text-cyan-600 font-medium"
              >
                <Phone className="w-3.5 h-3.5" />
                {item.customerPhone}
              </a>
            )}
            {item.saleId && (
              <button
                onClick={() => navigate('sale-detail', item.saleId!)}
                className="flex items-center gap-1.5 text-xs text-cyan-600 font-medium mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                View Sale
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No customer information</p>
        )}
      </motion.div>

      {/* New Claim Button + Dialog */}
      {canCreateClaim && (
        <motion.div
          variants={fadeChild}
          initial="initial"
          animate="animate"
        >
          <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 rounded-2xl h-11 text-sm font-semibold">
                <Plus className="w-4 h-4 mr-2" />
                New Warranty Claim
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle className="text-base">
                  New Warranty Claim
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    Issue Description <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    placeholder="Describe the issue in detail..."
                    value={claimDescription}
                    onChange={(e) => setClaimDescription(e.target.value)}
                    rows={3}
                    className="rounded-xl text-sm resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Customer Name</Label>
                  <Input
                    value={claimCustomerName}
                    onChange={(e) => setClaimCustomerName(e.target.value)}
                    className="rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    Customer Phone
                  </Label>
                  <Input
                    value={claimCustomerPhone}
                    onChange={(e) => setClaimCustomerPhone(e.target.value)}
                    className="rounded-xl text-sm"
                  />
                </div>
                <Button
                  onClick={handleCreateClaim}
                  disabled={
                    !claimDescription.trim() || submittingClaim
                  }
                  className="w-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 rounded-2xl h-11 text-sm font-semibold"
                >
                  {submittingClaim ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Submit Claim
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>
      )}

      {/* Claims History Section */}
      <motion.div
        variants={fadeChild}
        initial="initial"
        animate="animate"
        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-500" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Claims History
            </h3>
          </div>
          {claims.length > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] font-semibold bg-cyan-50 text-cyan-600"
            >
              {claims.length}
            </Badge>
          )}
        </div>

        {claimsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-1.5" />
            <p className="text-xs text-gray-400">No claims yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto cctv-scrollbar">
            {claims.map((claim, i) => {
              const cfg = CLAIM_STATUS_CONFIG[claim.status] || {
                badge: 'bg-gray-100 text-gray-600',
                label: claim.status,
              };

              return (
                <motion.div
                  key={claim.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: {
                      duration: 0.2,
                      delay: i * 0.04,
                      ease: [0, 0, 0.2, 1],
                    },
                  }}
                  className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 space-y-2"
                >
                  {/* Claim header */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                        cfg.badge
                      )}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {relativeDate(claim.createdAt)}
                    </span>
                  </div>

                  {/* Issue */}
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {claim.issueDescription}
                  </p>

                  {/* Resolution notes */}
                  {claim.resolutionNotes && (
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-gray-500">
                        {claim.resolutionNotes}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    {claim.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] rounded-lg font-semibold border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-2.5"
                          disabled={actionLoading === claim.id}
                          onClick={() =>
                            updateClaimStatus(claim.id, 'APPROVED')
                          }
                        >
                          {actionLoading === claim.id ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          )}
                          Approve
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] rounded-lg font-semibold border-red-200 text-red-700 hover:bg-red-50 px-2.5"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base">
                                Reject Claim?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                This will mark the warranty claim as rejected.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  updateClaimStatus(claim.id, 'REJECTED')
                                }
                                className="bg-red-600 hover:bg-red-700 rounded-xl"
                              >
                                Reject
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}

                    {claim.status === 'APPROVED' && (
                      <Button
                        size="sm"
                        className="h-7 text-[10px] rounded-lg font-semibold bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-sm px-2.5"
                        disabled={actionLoading === claim.id}
                        onClick={() =>
                          updateClaimStatus(claim.id, 'IN_PROGRESS')
                        }
                      >
                        {actionLoading === claim.id ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Wrench className="w-3 h-3 mr-1" />
                        )}
                        Start Repair
                      </Button>
                    )}

                    {claim.status === 'IN_PROGRESS' && (
                      <Dialog
                        open={
                          completeDialogOpen &&
                          completeClaimId === claim.id
                        }
                        onOpenChange={(open) => {
                          setCompleteDialogOpen(open);
                          if (!open) {
                            setCompleteClaimId(null);
                            setResolutionNotes('');
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            className="h-7 text-[10px] rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Complete
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl max-w-md mx-auto">
                          <DialogHeader>
                            <DialogTitle className="text-base">
                              Complete Claim
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 mt-2">
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">
                                Resolution Notes
                              </Label>
                              <Textarea
                                placeholder="Describe what was done to resolve the issue..."
                                value={resolutionNotes}
                                onChange={(e) =>
                                  setResolutionNotes(e.target.value)
                                }
                                rows={3}
                                className="rounded-xl text-sm resize-none"
                              />
                            </div>
                            <Button
                              onClick={handleCompleteClaim}
                              disabled={submittingComplete}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-11 text-sm font-semibold"
                            >
                              {submittingComplete ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                              )}
                              Mark as Completed
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Timeline Section */}
      {item.history && item.history.length > 0 && (
        <motion.div
          variants={fadeChild}
          initial="initial"
          animate="animate"
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-cyan-500" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Timeline
            </h3>
          </div>
          <div className="space-y-0 max-h-60 overflow-y-auto cctv-scrollbar">
            {item.history.map((entry, i) => (
              <div key={entry.id} className="flex gap-3">
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-2.5 h-2.5 rounded-full shrink-0 mt-1.5',
                      i === 0
                        ? 'bg-cyan-500 ring-2 ring-cyan-100'
                        : 'bg-gray-300'
                    )}
                  />
                  {i < item.history.length - 1 && (
                    <div className="w-px flex-1 bg-gray-200 mt-1" />
                  )}
                </div>
                {/* Content */}
                <div className="pb-3 min-w-0">
                  <p className="text-xs font-semibold text-gray-800">
                    {entry.event}
                  </p>
                  {entry.notes && (
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                      {entry.notes}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {relativeDate(entry.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}