"use client";

// ── ContactsCard ──
// Manage business owner contacts (email + WhatsApp) with inline editing.
// Uses apiFetch from AdminContext for automatic auth + 401 handling.

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
import { useAdmin } from "./AdminContext";

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP_REGEX = /^\+\d{10,15}$/;

export function ContactsCard({ token }: { token: string }) {
  const { apiFetch, notify } = useAdmin();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ ownerEmail: "", ownerWhatsapp: "" });
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [whatsappValid, setWhatsappValid] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/super-admin/businesses");
      if (!res.ok) return;
      const data = await res.json();
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
  }, [apiFetch]);

  useEffect(() => { void load(); }, [load]);

  const handleEdit = (contact: Contact) => {
    setEditingId(contact.businessId);
    setEditState({
      ownerEmail: contact.ownerEmail || "",
      ownerWhatsapp: contact.ownerWhatsapp || "",
    });
    setEmailValid(null);
    setWhatsappValid(null);
  };

  const handleEmailChange = (value: string) => {
    setEditState((prev) => ({ ...prev, ownerEmail: value }));
    if (!value.trim()) {
      setEmailValid(null);
    } else {
      setEmailValid(EMAIL_REGEX.test(value));
    }
  };

  const handleWhatsappChange = (value: string) => {
    setEditState((prev) => ({ ...prev, ownerWhatsapp: value }));
    if (!value.trim()) {
      setWhatsappValid(null);
    } else {
      setWhatsappValid(WHATSAPP_REGEX.test(value));
    }
  };

  const handleSave = async (businessId: string) => {
    // Validate
    if (editState.ownerEmail && !EMAIL_REGEX.test(editState.ownerEmail)) {
      notify("err", "Invalid email format. Must contain @ and a domain.");
      return;
    }
    if (editState.ownerWhatsapp && !WHATSAPP_REGEX.test(editState.ownerWhatsapp)) {
      notify("err", "Invalid WhatsApp number. Must start with + and be 10-15 digits.");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(`/api/super-admin/businesses/${businessId}/contacts`, {
        method: "PATCH",
        body: JSON.stringify({
          ownerEmail: editState.ownerEmail || null,
          ownerWhatsapp: editState.ownerWhatsapp || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      notify("ok", "Contact updated successfully");
      setEditingId(null);
      await load();
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditState({ ownerEmail: "", ownerWhatsapp: "" });
    setEmailValid(null);
    setWhatsappValid(null);
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
              Email + WhatsApp for report delivery.{" "}
              {missingEmailCount > 0 && (
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

                      {/* Edit mode */}
                      {isEditing ? (
                        <div className="mt-3 space-y-3">
                          {/* Email field */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Owner Email</label>
                            <Input
                              type="email"
                              value={editState.ownerEmail}
                              onChange={(e) => handleEmailChange(e.target.value)}
                              placeholder="owner@pharmacy.com"
                              className={`mt-1 h-9 text-sm ${emailValid === false ? "border-red-400" : emailValid === true ? "border-emerald-400" : ""}`}
                            />
                            {emailValid === false && (
                              <p className="text-xs text-red-500 mt-0.5">Invalid email format</p>
                            )}
                            {emailValid === true && (
                              <p className="text-xs text-emerald-600 mt-0.5">✓ Valid email</p>
                            )}
                          </div>

                          {/* WhatsApp field */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">WhatsApp Number</label>
                            <Input
                              type="tel"
                              value={editState.ownerWhatsapp}
                              onChange={(e) => handleWhatsappChange(e.target.value)}
                              placeholder="+8801712345678"
                              className={`mt-1 h-9 text-sm ${whatsappValid === false ? "border-red-400" : whatsappValid === true ? "border-emerald-400" : ""}`}
                            />
                            {whatsappValid === false && (
                              <p className="text-xs text-red-500 mt-0.5">Must start with + and 10-15 digits</p>
                            )}
                            {whatsappValid === true && (
                              <p className="text-xs text-emerald-600 mt-0.5">✓ Valid number</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Leave blank to use business phone ({contact.phone || "none set"})
                            </p>
                          </div>

                          {/* Save / Cancel buttons */}
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() => handleSave(contact.businessId)}
                              disabled={saving || (!!editState.ownerEmail && emailValid === false) || (!!editState.ownerWhatsapp && whatsappValid === false)}
                            >
                              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              <span className="ml-1">Save</span>
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancel}>
                              <X className="h-3 w-3" />
                              <span className="ml-1">Cancel</span>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Display mode */
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {/* Email */}
                          <div className="flex items-center gap-1.5 text-xs">
                            <Mail className={`h-3 w-3 ${hasEmail ? "text-blue-600" : "text-amber-600"}`} />
                            {hasEmail ? (
                              <span className="text-slate-600 dark:text-slate-400">{contact.email}</span>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 text-xs">No email set</Badge>
                            )}
                          </div>

                          {/* WhatsApp */}
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

                    {/* Edit button (only in display mode) */}
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
            <li>• Click the edit (pencil) icon to add or change contacts</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
