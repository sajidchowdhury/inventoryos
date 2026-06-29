"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, User, Edit2, Trash2,
  Shield, Check, AlertCircle, Loader2, UserCog, Lock,
  Phone, Mail, Eye, EyeOff, Monitor, History,
  Users as UsersIcon, ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  username: string;
  role: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface RoleDef {
  name: string;
  label: string;
  description: string;
  color: string;
  permissions: string[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

// Role color system: owner=purple, admin=emerald, manager=blue,
// pharmacist=cyan, cashier=amber, stock_clerk=gray
const roleStyles: Record<string, { badge: string; grad: string; ring: string }> = {
  owner:       { badge: "bg-purple-100 text-purple-700",  grad: "from-purple-500 to-fuchsia-500",  ring: "ring-purple-200" },
  admin:       { badge: "bg-emerald-100 text-emerald-700", grad: "from-emerald-500 to-teal-500",   ring: "ring-emerald-200" },
  manager:     { badge: "bg-blue-100 text-blue-700",       grad: "from-blue-500 to-indigo-500",    ring: "ring-blue-200" },
  pharmacist:  { badge: "bg-cyan-100 text-cyan-700",       grad: "from-cyan-500 to-sky-500",       ring: "ring-cyan-200" },
  cashier:     { badge: "bg-amber-100 text-amber-700",     grad: "from-amber-500 to-orange-500",   ring: "ring-amber-200" },
  stock_clerk: { badge: "bg-slate-100 text-slate-700",     grad: "from-slate-500 to-slate-600",    ring: "ring-slate-200" },
};

const defaultRoleStyle = roleStyles.stock_clerk;

const emptyForm = {
  username: "",
  password: "",
  fullName: "",
  role: "pharmacist",
  phone: "",
  email: "",
  isActive: true,
};

export function UserManagement() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;
  const currentUserId = session?.user?.id;

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/users`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        setRoles(data.roles || []);
      }
    } catch (err) {
      console.error("Fetch users error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreateDialog = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setForm({
      username: user.username,
      password: "", // empty = no change
      fullName: user.fullName || "",
      role: user.role,
      phone: user.phone || "",
      email: user.email || "",
      isActive: user.isActive,
    });
    setEditingId(user.id);
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!businessId || !form.username.trim()) {
      setError("Username is required");
      return;
    }
    if (!editingId && !form.password) {
      setError("Password is required for new users");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = editingId
        ? `/api/businesses/${businessId}/users/${editingId}`
        : `/api/businesses/${businessId}/users`;
      const method = editingId ? "PUT" : "POST";
      const payload: Record<string, unknown> = { ...form };
      if (editingId && !form.password) delete payload.password;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setDialogOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!businessId || !deleteConfirm) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/users/${deleteConfirm.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // Inline active-status toggle — uses existing PUT endpoint
  const handleToggleActive = async (user: User) => {
    if (!businessId || user.id === currentUserId) return;
    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/businesses/${businessId}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          fullName: user.fullName || "",
          role: user.role,
          phone: user.phone || "",
          email: user.email || "",
          isActive: !user.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      fetchUsers();
    } catch (err) {
      console.error("Toggle active error:", err);
    } finally {
      setTogglingId(null);
    }
  };

  const getRoleLabel = (role: string) => roles.find((r) => r.name === role)?.label || role;
  const getRolePerms = (role: string) => roles.find((r) => r.name === role)?.permissions || [];

  return (
    <motion.div
      {...fadeIn}
      className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4 pb-6"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy" onClick={() => setActiveView("more-hub")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">User Management</h1>
          <p className="text-[11px] text-muted-foreground">Roles, permissions & team</p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0 shadow-md shadow-emerald-500/20"
          onClick={openCreateDialog}
        >
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-2 stagger-in">
        <Card className="card-hover shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-3 text-center">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-1">
              <UsersIcon className="h-4 w-4 text-white" />
            </div>
            <p className="text-base font-bold text-emerald-600">{users.length}</p>
            <p className="text-[9px] text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card className="card-hover shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-3 text-center">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-500 flex items-center justify-center mx-auto mb-1">
              <Check className="h-4 w-4 text-white" />
            </div>
            <p className="text-base font-bold text-cyan-600">{users.filter((u) => u.isActive).length}</p>
            <p className="text-[9px] text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="card-hover shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-3 text-center">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-1">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <p className="text-base font-bold text-purple-600">{users.filter((u) => u.role === "admin" || u.role === "owner").length}</p>
            <p className="text-[9px] text-muted-foreground">Admins</p>
          </CardContent>
        </Card>
      </div>

      {/* ── User List ── */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-0 shadow-pharmacy">
              <CardContent className="p-4 h-20 skeleton rounded-xl" />
            </Card>
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card className="shadow-pharmacy border-0">
          <CardContent className="p-8 text-center space-y-2">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <User className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="font-semibold">No users found</p>
            <p className="text-xs text-muted-foreground">Add a user to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const style = roleStyles[user.role] || defaultRoleStyle;
            return (
              <Card
                key={user.id}
                className={cn(
                  "card-hover shadow-pharmacy border-0 overflow-hidden stagger-in",
                  !user.isActive && "opacity-60"
                )}
              >
                <CardContent className="p-3 flex items-start gap-3">
                  {/* Gradient avatar */}
                  <div className={cn(
                    "h-11 w-11 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm",
                    style.grad
                  )}>
                    {user.role === "owner" || user.role === "admin"
                      ? <Shield className="h-5 w-5 text-white" />
                      : <User className="h-5 w-5 text-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold">{user.fullName || user.username}</p>
                      <Badge variant="outline" className={cn("text-[9px]", style.badge)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                      {user.id === currentUserId && (
                        <Badge className="text-[9px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">You</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">@{user.username}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      {user.phone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{user.phone}</span>}
                      {user.lastLoginAt && (
                        <span>Last login: {new Date(user.lastLoginAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded-md hover:bg-muted" onClick={() => openEditDialog(user)} title="Edit">
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded-md hover:bg-muted" onClick={() => setPasswordUser(user)} title="Change password">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      {user.id !== currentUserId && (
                        <button className="p-1.5 rounded-md hover:bg-red-50" onClick={() => setDeleteConfirm(user)} title="Deactivate">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      )}
                    </div>
                    {/* Active status toggle */}
                    {user.id !== currentUserId && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-muted-foreground">Active</span>
                        <Switch
                          checked={user.isActive}
                          disabled={togglingId === user.id}
                          onCheckedChange={() => handleToggleActive(user)}
                          className="scale-75"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Username *</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-10" placeholder="e.g., pharmacist1" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Password {editingId ? "(leave empty to keep current)" : "*"}
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-10 pr-9"
                  placeholder={editingId ? "••••••" : "Enter password"}
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Full Name</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="h-10" placeholder="e.g., Dr. Rahim Ahmed" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.name} value={role.name}>
                      <div>
                        <p className="text-sm font-medium">{role.label}</p>
                        <p className="text-[10px] text-muted-foreground">{role.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Permission grid — read-only preview of selected role's permissions */}
            {form.role && getRolePerms(form.role).length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" /> Permissions
                </Label>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                  {getRolePerms(form.role).map((perm) => (
                    <div key={perm} className="flex items-center gap-1.5">
                      <Switch checked disabled className="scale-75" />
                      <span className="text-[10px] text-muted-foreground capitalize">{perm.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10" placeholder="01XXXXXXXXX" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10" />
              </div>
            </div>

            {editingId && (
              <div className="flex items-center justify-between py-1 px-3 rounded-lg bg-muted/30">
                <Label className="text-xs font-medium">Active</Label>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
              </div>
            )}

            <Button
              className="w-full h-10 gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0 shadow-md shadow-emerald-500/20"
              onClick={handleSave}
              disabled={saving || !form.username.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
              {saving ? "Saving..." : editingId ? "Update User" : "Create User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Deactivate User</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
            <p className="text-sm">
              Deactivate <strong>{deleteConfirm?.fullName || deleteConfirm?.username}</strong>?
            </p>
            <p className="text-xs text-muted-foreground">
              The user will be signed out immediately and cannot log in until reactivated.
              Their historical actions are preserved.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1 gap-1.5" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Deactivate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Change Password Dialog ── */}
      <Dialog open={!!passwordUser} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
          {passwordUser && (
            <ChangePasswordDialog
              userId={passwordUser.id}
              username={passwordUser.fullName || passwordUser.username}
              onComplete={() => { setPasswordUser(null); fetchUsers(); }}
              onCancel={() => setPasswordUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Security Links ── */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button variant="outline" className="gap-2 h-11 shadow-pharmacy" onClick={() => setActiveView("sessions")}>
          <Monitor className="h-4 w-4" /> Active Sessions
        </Button>
        <Button variant="outline" className="gap-2 h-11 shadow-pharmacy" onClick={() => setActiveView("login-activity")}>
          <History className="h-4 w-4" /> Login Activity
        </Button>
      </div>
    </motion.div>
  );
}
