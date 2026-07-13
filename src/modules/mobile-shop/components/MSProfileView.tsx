'use client';

import { motion } from 'framer-motion';
import {
  ArrowLeft, LogOut, Building2, User, Shield, Lock,
  Users, CreditCard, ChevronRight, Sparkles,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const menuItems = [
  { icon: Building2, label: 'Business Info', desc: 'Shop details & address', grad: 'from-cyan-500 to-blue-600' },
  { icon: Lock, label: 'Change Password', desc: 'Update your password', grad: 'from-amber-500 to-orange-500' },
  { icon: Users, label: 'Staff Management', desc: 'Team roles & access', grad: 'from-emerald-500 to-teal-500' },
  { icon: CreditCard, label: 'Subscription Status', desc: 'Plan & billing info', grad: 'from-sky-500 to-cyan-500' },
];

export function MSProfileView() {
  const { goBack } = useMSNavStore();
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);

  if (!session) return null;

  const { business, user } = session;
  const displayName = user.fullName || user.username || user.name;
  const firstLetter = (displayName || 'U').charAt(0).toUpperCase();

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Profile</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm overflow-hidden relative">
        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-cyan-50" />
        <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-cyan-50" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
              <span className="text-white text-2xl font-bold">{firstLetter}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 leading-tight truncate">{displayName}</h2>
              <p className="text-xs text-gray-400 capitalize mt-0.5 flex items-center gap-1">
                <Shield className="w-3 h-3" /> {user.role || 'Owner'} access
              </p>
              {business.name && (
                <p className="text-[10px] text-gray-400 truncate mt-0.5 flex items-center gap-1">
                  <Building2 className="w-2.5 h-2.5" /> {business.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Business details */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-900 mb-3">Business Details</p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Business Name</p>
              <p className="text-sm font-medium text-gray-900 truncate">{business.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Shop Code</p>
              <p className="text-sm font-mono font-medium text-gray-900">{business.shopCode || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Owner</p>
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Phone</p>
              <p className="text-sm font-medium text-gray-900">{business.phone || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
        {menuItems.map((item) => (
          <button
            key={item.label}
            className="w-full p-3.5 flex items-center gap-3 active:bg-gray-50 transition-colors text-left"
          >
            <div className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0', item.grad)}>
              <item.icon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="text-[11px] text-gray-400">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          </button>
        ))}
      </div>

      {/* Logout button */}
      <button
        onClick={logout}
        className="w-full h-12 rounded-2xl border-2 border-red-200 text-red-600 text-sm font-semibold flex items-center justify-center gap-2 active:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Log Out
      </button>

      <p className="text-center text-[10px] text-gray-400 pt-1">
        InventoryOS · CCTV Shop Management
      </p>
    </motion.div>
  );
}