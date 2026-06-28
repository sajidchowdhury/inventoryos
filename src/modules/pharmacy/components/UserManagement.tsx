"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, User, Search, X, Edit2, Trash2,
  Shield, Check, AlertCircle, Loader2, UserCog, Lock,
  Phone, Mail, Eye, EyeOff, Monitor, History,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

const roleColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  manager: "bg-green-100 text-green-700",
  pharmacist: "bg-orange-100 text-orange-700",
  cashier: "bg-red-100 text-red-700",
  stock_clerk: "bg-indigo-100 text-indigo-700",
};

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

  const getRoleLabel = (role: string) => roles.find((r) => r.name === role)?.label || role;

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">User Management</h1>
        <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* Role Legend */}
      <Card>
        <CardContent className="p-3">
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Roles
          </p>
          <div className="flex flex-wrap gap-1.5">
            {roles.map((role) => (
              <Badge key={role.name} variant="outline" className={cn("text-[9px]", roleColors[role.name])}>
                {role.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-2 text-center">
          <p className="text-base font-bold text-primary">{users.length}</p>
          <p className="text-[9px] text-muted-foreground">Total Users</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-base font-bold text-green-600">{users.filter((u) => u.isActive).length}</p>
          <p className="text-[9px] text-muted-foreground">Active</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-base font-bold text-orange-600">{users.filter((u) => u.role === "admin" || u.role === "owner").length}</p>
          <p className="text-[9px] text-muted-foreground">Admins</p>
        </CardContent></Card>
      </div>

      {/* User List */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}</div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <User className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <Card key={user.id} className={cn("overflow-hidden", !user.isActive && "opacity-60")}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                  roleColors[user.role]?.split(" ")[1] || "bg-muted"
                )}>
                  {user.role === "owner" || user.role === "admin"
                    ? <Shield className="h-5 w-5" />
                    : <User className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{user.fullName || user.username}</p>
                    <Badge variant="outline" className={cn("text-[9px]", roleColors[user.role])}>
                      {getRoleLabel(user.role)}
                    </Badge>
                    {user.id === currentUserId && (
                      <Badge variant="secondary" className="text-[9px]">You</Badge>
                    )}
                    {!user.isActive && (
                      <Badge variant="outline" className="text-[9px] text-red-600">Inactive</Badge>
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
                <div className="flex flex-col gap-1 shrink-0">
                  <button className="p-1.5 rounded hover:bg-muted" onClick={() => openEditDialog(user)}>
                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-muted" onClick={() => setPasswordUser(user)}>
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  {user.id !== currentUserId && (
                    <button className="p-1.5 rounded hover:bg-red-50" onClick={() => setDeleteConfirm(user)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
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
              <div className="flex items-center justify-between py-1">
                <Label className="text-xs font-medium">Active</Label>
                <button
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors",
                    form.isActive ? "bg-green-500" : "bg-muted"
                  )}
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                >
                  <div className={cn(
                    "w-4 h-4 bg-white rounded-full transition-transform m-0.5",
                    form.isActive ? "translate-x-5" : ""
                  )} />
                </button>
              </div>
            )}

            <Button className="w-full h-10 gap-2" onClick={handleSave} disabled={saving || !form.username.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
              {saving ? "Saving..." : editingId ? "Update User" : "Create User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
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

      {/* Change Password Dialog */}
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

      {/* Security Links */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button variant="outline" className="gap-2 h-11" onClick={() => setActiveView("sessions")}>
          <Monitor className="h-4 w-4" /> Active Sessions
        </Button>
        <Button variant="outline" className="gap-2 h-11" onClick={() => setActiveView("login-activity")}>
          <History className="h-4 w-4" /> Login Activity
        </Button>
      </div>
    </motion.div>
  );
}
