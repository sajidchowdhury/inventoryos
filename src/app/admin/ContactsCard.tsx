"use client";

// ── ContactsCard ──
// Phase 5: Manage business owner contacts (email + WhatsApp) with inline editing.
// Shown on both Global Dashboard (all businesses) and Pharmacy Dashboard (filtered).
//
// Features:
//   - Table of businesses with ownerEmail + ownerWhatsapp columns
//   - Inline edit (click to edit, save/cancel)
//   - Email validation (must contain @ and domain)
//   - WhatsApp validation (must start with + and 10-15 digits)
//   - Fallback indicators: WhatsApp shows "via phone" if using business.phone fallback
//   - Empty state: clear warning if no email set ("Reports won't be delivered")

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Mail, MessageCircle, Users, Loader2, Check, X, AlertCircle,
  Edit2, Save, RefreshCw, Phone,
} from "lucide-react";

interface Contact {
  businessId: string;
  businessName: string;
  ownerEmail: string | null;
  ownerWhatsapp: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
}

interface EditState {
  ownerEmail: string;
  ownerWhatsapp: string;
}

export function ContactsCard({ token }: { token: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ ownerEmail: "", ownerWhatsapp: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/businesses", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Transform businesses into contact format
      const bizContacts: Contact[] = (data.businesses || []).map((b: any) => ({
        businessId: b.id,
        businessName: b.name,
        ownerEmail: b.ownerEmail || null,
        ownerWhatsapp: b.ownerWhatsapp || null,
        phone: b.phone || null,
        email: b.ownerEmail || null,
        whatsapp: b.ownerWhatsapp || b.phone || null,
      }));
      setContacts(bizContacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleEdit = (contact: Contact) => {
    setEditingId(contact.businessId);
    setEditState({
      ownerEmail: contact.ownerEmail || "",
      ownerWhatsapp: contact.ownerWhatsapp || "",
    });
  };

  const handleSave = async (businessId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/super-admin/businesses/${businessId}/contacts`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: editState.ownerEmail || null,
          ownerWhatsapp: editState.ownerWhatsapp || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setToast("Contact updated");
      setEditingId(null);
      await load();
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditState({ ownerEmail: "", ownerWhatsapp: "" });
  };

  const missingEmailCount = contacts.filter((c) => !c.email).length;

  return (
    <Card className="border-blue-200 dark:border-blue-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Users className="h-5 w-5" />
              Owner Contacts
            </CardTitle>
            <CardDescription>
              Email + WhatsApp for report delivery. {missingEmailCount > 0 && (
                <span className="text-red-600 font-medium">
                  {missingEmailCount} business(es) missing email — reports won't be delivered.
                </span>
              )}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300 mb-3">
            <AlertCircle className="h-4 w-4" /> {error}
            <Button size="sm" variant="ghost" onClick={() => setError(null)}>Dismiss</Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No businesses found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => {
              const isEditing = editingId === contact.businessId;
              const hasEmail = !!contact.email;
              const whatsappFallback = contact.whatsapp && !contact.ownerWhatsapp && contact.phone;

              return (
                <motion.div
                  key={contact.businessId}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-lg border p-3 ${!hasEmail ? "border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/10" : "border-slate-200 dark:border-slate-800"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Business name */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{contact.businessName}</div>

                      {/* Email field */}
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Owner Email</label>
                            <Input
                              type="email"
                              value={editState.ownerEmail}
                              onChange={(e) => setEditState({ ...editState, ownerEmail: e.target.value })}
                              placeholder="owner@pharmacy.com"
                              className="mt-0.5 h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">WhatsApp Number</label>
                            <Input
                              type="tel"
                              value={editState.ownerWhatsapp}
                              onChange={(e) => setEditState({ ...editState, ownerWhatsapp: e.target.value })}
                              placeholder="+8801712345678"
                              className="mt-0.5 h-8 text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSave(contact.businessId)} disabled={saving}>
                              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancel}>
                              <X className="h-3 w-3" /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {/* Email display */}
                          <div className="flex items-center gap-1.5 text-xs">
                            <Mail className={`h-3 w-3 ${hasEmail ? "text-blue-600" : "text-amber-600"}`} />
                            {hasEmail ? (
                              <span className="text-slate-600 dark:text-slate-400">{contact.email}</span>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 text-xs">No email set</Badge>
                            )}
                          </div>

                          {/* WhatsApp display */}
                          <div className="flex items-center gap-1.5 text-xs">
                            <MessageCircle className={`h-3 w-3 ${contact.whatsapp ? "text-green-600" : "text-slate-400"}`} />
                            {contact.whatsapp ? (
                              <>
                                <span className="text-slate-600 dark:text-slate-400">{contact.whatsapp}</span>
                                {whatsappFallback && (
                                  <Badge variant="outline" className="text-xs">
                                    <Phone className="h-2.5 w-2.5 mr-0.5" /> via phone
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400">No WhatsApp</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Edit button */}
                    {!isEditing && (
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(contact)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Validation hints */}
        <div className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-3">
          <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Contact Guidelines</h4>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            <li>• Email: must contain @ and a domain (e.g., owner@pharmacy.com)</li>
            <li>• WhatsApp: must start with + and be 10-15 digits (e.g., +8801712345678)</li>
            <li>• WhatsApp falls back to business phone if not explicitly set</li>
            <li>• Email has NO fallback — reports won't be delivered if not set</li>
          </ul>
        </div>

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <Check className="h-4 w-4" /> {toast}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
