"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/lib/auth-store";

interface ChangePasswordDialogProps {
  userId: string;
  username: string;
  requireCurrentPassword?: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

export function ChangePasswordDialog({ userId, username, requireCurrentPassword = false, onComplete, onCancel }: ChangePasswordDialogProps) {
  const session = useAuthStore((s) => s.session);
  const businessId = session?.business?.id;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [invalidateSessions, setInvalidateSessions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = newPassword === confirmPassword;
  const validLength = newPassword.length >= 4;
  const canSubmit = newPassword && passwordsMatch && validLength && (!requireCurrentPassword || currentPassword);

  const handleSubmit = async () => {
    if (!businessId) return;
    if (!passwordsMatch) {
      setError("Passwords don't match");
      return;
    }
    if (!validLength) {
      setError("Password must be at least 4 characters");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/users/${userId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: requireCurrentPassword ? currentPassword : undefined,
          newPassword,
          invalidateOtherSessions: invalidateSessions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      <div className="bg-muted/30 rounded-lg p-2.5 text-xs text-muted-foreground">
        Changing password for <strong>{username}</strong>
      </div>

      {requireCurrentPassword && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Current Password *</Label>
          <div className="relative">
            <Input
              type={showPasswords ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setError(null); }}
              className="h-10 pr-9"
              placeholder="Enter current password"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPasswords(!showPasswords)}>
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">New Password *</Label>
        <Input
          type={showPasswords ? "text" : "password"}
          value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
          className="h-10"
          placeholder="At least 4 characters"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Confirm New Password *</Label>
        <Input
          type={showPasswords ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
          className="h-10"
          placeholder="Re-enter new password"
        />
        {confirmPassword && !passwordsMatch && (
          <p className="text-[11px] text-destructive">Passwords don't match</p>
        )}
      </div>

      <div className="flex items-center justify-between py-1">
        <div>
          <Label className="text-xs font-medium">Sign out other devices</Label>
          <p className="text-[10px] text-muted-foreground">Invalidate all active sessions</p>
        </div>
        <Switch checked={invalidateSessions} onCheckedChange={setInvalidateSessions} />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button className="flex-1 gap-1.5" onClick={handleSubmit} disabled={saving || !canSubmit}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {saving ? "Changing..." : "Change Password"}
        </Button>
      </div>
    </div>
  );
}
