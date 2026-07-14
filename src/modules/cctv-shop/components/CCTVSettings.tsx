'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, Lock, Users, Shield, CreditCard, Plus, X,
  Check, Eye, EyeOff, Phone, User, ChevronRight, KeyRound,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

type SettingsTab = 'password' | 'users' | 'permissions' | 'subscription';

export function CCTVSettings() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('password');

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl">
        {[
          { key: 'password' as const, label: 'Password', icon: Lock },
          { key: 'users' as const, label: 'Users', icon: Users },
          { key: 'permissions' as const, label: 'Permissions', icon: Shield },
          { key: 'subscription' as const, label: 'Subscription', icon: CreditCard },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 h-10 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5',
              activeTab === tab.key
                ? 'bg-white text-violet-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'password' && <ChangePasswordTab businessId={businessId} />}
      {activeTab === 'users' && <UsersTab businessId={businessId} />}
      {activeTab === 'permissions' && <PermissionsTab businessId={businessId} />}
      {activeTab === 'subscription' && <SubscriptionTab businessId={businessId} />}
    </motion.div>
  );
}

// ── Change Password Tab ──
function ChangePasswordTab({ businessId }: { businessId?: string }) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!newPassword || newPassword.length < 4) {
      toast({ title: 'Error', description: 'Password must be at least 4 characters', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Get current user ID from auth store
      const session = useAuthStore.getState().session;
      const userId = session?.user?.id;
      if (!userId || !businessId) {
        toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' });
        return;
      }

      const res = await fetch(`/api/businesses/${businessId}/users/${userId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (res.ok) {
        toast({ title: 'Password changed', description: 'Your password has been updated' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
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

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-violet-500" />
        <h2 className="text-sm font-bold text-gray-800">Change Password</h2>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Current Password</Label>
          <div className="relative">
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="h-10 rounded-xl pr-10"
            />
            <button
              onClick={() => setShowPasswords(!showPasswords)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">New Password</Label>
          <Input
            type={showPasswords ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            className="h-10 rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Confirm New Password</Label>
          <Input
            type={showPasswords ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            className="h-10 rounded-xl"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving || !currentPassword || !newPassword || !confirmPassword}
        className="w-full h-11 rounded-xl bg-violet-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        {saving ? 'Saving...' : 'Update Password'}
      </button>
    </div>
  );
}

// ── Users Tab ──
function UsersTab({ businessId }: { businessId?: string }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [saving, setSaving] = useState(false);

  const loadUsers = () => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/users`)
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, [businessId]);

  const handleCreate = async () => {
    if (!fullName.trim() || !username.trim() || !password.trim()) {
      toast({ title: 'Error', description: 'Name, username, and password are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim(),
          phone: phone.trim() || undefined,
          password,
          role,
        }),
      });
      if (res.ok) {
        toast({ title: 'User created', description: `${fullName} can now log in` });
        setShowForm(false);
        setFullName(''); setUsername(''); setPhone(''); setPassword(''); setRole('staff');
        loadUsers();
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

  const toggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res.ok) {
        toast({ title: currentActive ? 'User deactivated' : 'User activated' });
        loadUsers();
      }
    } catch {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-500" /> Users ({users.length})
          </h2>
          <button
            onClick={() => setShowForm(true)}
            className="h-8 px-3 rounded-lg bg-violet-500 text-white text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add User
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  u.isActive ? 'bg-violet-100' : 'bg-gray-200'
                )}>
                  <User className={cn('w-4 h-4', u.isActive ? 'text-violet-600' : 'text-gray-400')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{u.fullName}</p>
                  <p className="text-[10px] text-gray-500">
                    @{u.username} · {u.role}
                  </p>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded text-[9px] font-semibold',
                  u.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                )}>
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
                <button
                  onClick={() => toggleUserActive(u.id, u.isActive)}
                  className="text-[10px] text-gray-500 hover:text-violet-600 font-medium"
                >
                  {u.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create user dialog */}
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
                <h3 className="text-base font-bold text-gray-900">New User</h3>
                <button onClick={() => setShowForm(false)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Full Name *</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe" className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Username *</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder="john" className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX" className="h-10 rounded-xl" type="tel" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Password *</Label>
                  <Input value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 4 characters" className="h-10 rounded-xl" type="password" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Role</Label>
                  <select value={role} onChange={(e) => setRole(e.target.value)}
                    className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white">
                    <option value="admin">Admin (full access)</option>
                    <option value="manager">Manager (most access)</option>
                    <option value="staff">Staff (limited access)</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="w-full h-11 mt-4 rounded-xl bg-violet-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {saving ? 'Creating...' : 'Create User'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Permissions Tab ──
function PermissionsTab({ businessId }: { businessId?: string }) {
  const [permissions, setPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/permissions`)
      .then((r) => r.json())
      .then((data) => { setPermissions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [businessId]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>;
  }

  if (!permissions) return null;

  const { role, permissions: perms, roles } = permissions;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-violet-500" /> Your Permissions
        </h2>
        <div className="bg-violet-50 rounded-xl p-3 mb-3">
          <p className="text-xs text-gray-500">Your Role</p>
          <p className="text-sm font-bold text-violet-700 capitalize">{role || 'admin'}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(perms || {}).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <div className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                value ? 'bg-emerald-100' : 'bg-gray-200'
              )}>
                {value ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-gray-400" />}
              </div>
              <span className="text-[10px] text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {roles && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-xs font-bold text-gray-700 mb-2">Available Roles</h3>
          <div className="space-y-2">
            {roles.map((r: any) => (
              <div key={r.name} className="p-3 bg-gray-50 rounded-xl">
                <p className="text-sm font-semibold text-gray-900 capitalize">{r.name}</p>
                <p className="text-[10px] text-gray-500">{r.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subscription Tab ──
function SubscriptionTab({ businessId }: { businessId?: string }) {
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/subscription`)
      .then((r) => r.json())
      .then((data) => { setSub(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [businessId]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>;
  }

  if (!sub) return null;

  return (
    <div className="space-y-3">
      {/* Plan card */}
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-white/70 uppercase tracking-wider">Current Plan</p>
            <p className="text-2xl font-bold mt-1 capitalize">{sub.tier || 'Free'}</p>
          </div>
          <CreditCard className="w-8 h-8 text-white/50" />
        </div>
        {sub.status && (
          <div className="mt-3 flex items-center gap-2">
            <span className={cn(
              'px-2 py-0.5 rounded text-[10px] font-bold',
              sub.status === 'active' ? 'bg-emerald-400/30 text-emerald-50' : 'bg-white/20 text-white'
            )}>
              {sub.status.toUpperCase()}
            </span>
            {sub.currentPeriodEnd && (
              <span className="text-[10px] text-white/70">
                Renews: {new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Usage */}
      {sub.usage && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Usage</h3>
          <div className="space-y-3">
            {sub.usage.products !== undefined && (
              <UsageBar
                label="Products"
                used={sub.usage.products}
                limit={sub.limits?.maxProducts}
              />
            )}
            {sub.usage.users !== undefined && (
              <UsageBar
                label="Users"
                used={sub.usage.users}
                limit={sub.limits?.maxUsers}
              />
            )}
          </div>
        </div>
      )}

      {/* Features */}
      {sub.features && Object.keys(sub.features).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Plan Features</h3>
          <div className="space-y-1.5">
            {Object.entries(sub.features).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={cn(
                  'w-4 h-4 rounded-full flex items-center justify-center shrink-0',
                  value ? 'bg-emerald-100' : 'bg-gray-200'
                )}>
                  {value ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <X className="w-2.5 h-2.5 text-gray-400" />}
                </div>
                <span className="text-xs text-gray-600 capitalize">{key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade button */}
      <button className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform">
        <CreditCard className="w-4 h-4" /> Upgrade Plan
      </button>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit?: number | null }) {
  const pct = limit && limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isWarning = limit && used >= limit * 0.8;

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className={cn('font-medium', isWarning ? 'text-amber-600' : 'text-gray-700')}>
          {used}{limit ? ` / ${limit}` : ''}
        </span>
      </div>
      {limit && limit > 0 && (
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full', isWarning ? 'bg-amber-500' : 'bg-violet-500')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
