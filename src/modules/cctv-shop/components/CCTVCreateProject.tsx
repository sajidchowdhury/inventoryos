'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, User, Phone, Mail, MapPin,
  Calendar, Package, DollarSign, FileText, Building2,
  ClipboardList,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import type { ProjectType } from '@/modules/cctv-shop/types';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const projectTypes: { value: ProjectType; label: string }[] = [
  { value: 'INSTALLATION', label: 'New Installation' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'UPGRADE', label: 'Upgrade' },
  { value: 'REPAIR', label: 'Repair' },
];

export function CCTVCreateProject() {
  const { goBack, navigate } = useCCTVNavStore();
  const businessId = useCctvBusinessId();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    projectName: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    clientAddress: '',
    projectType: 'INSTALLATION' as ProjectType,
    totalItems: '',
    projectValue: '',
    startDate: '',
    deadline: '',
    siteAddress: '',
    siteContact: '',
    siteContactPhone: '',
    notes: '',
    internalNotes: '',
  });

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.projectName.trim() || !form.clientName.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        projectName: form.projectName.trim(),
        clientName: form.clientName.trim(),
        projectType: form.projectType,
        totalItems: form.totalItems ? parseInt(form.totalItems) : 0,
        projectValue: form.projectValue ? parseFloat(form.projectValue) : 0,
      };
      if (form.clientPhone.trim()) body.clientPhone = form.clientPhone.trim();
      if (form.clientEmail.trim()) body.clientEmail = form.clientEmail.trim();
      if (form.clientAddress.trim()) body.clientAddress = form.clientAddress.trim();
      if (form.startDate) body.startDate = new Date(form.startDate).toISOString();
      if (form.deadline) body.deadline = new Date(form.deadline).toISOString();
      if (form.siteAddress.trim()) body.siteAddress = form.siteAddress.trim();
      if (form.siteContact.trim()) body.siteContact = form.siteContact.trim();
      if (form.siteContactPhone.trim()) body.siteContactPhone = form.siteContactPhone.trim();
      if (form.notes.trim()) body.notes = form.notes.trim();
      if (form.internalNotes.trim()) body.internalNotes = form.internalNotes.trim();

      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const project = await res.json();
        // Navigate to projects list so back button works correctly
        navigate('projects');
        return;
      }
    } catch { /* silent */ }
    setSaving(false);
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-xl bg-white border border-gray-100 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 shadow-sm';
  const labelClass = 'text-xs font-semibold text-gray-500 mb-1.5 block';

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">New Project</h1>
      </div>

      {/* Project Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-violet-500" />
          Project Info
        </h2>

        <div>
          <label className={labelClass}>Project Name *</label>
          <input
            type="text"
            placeholder="e.g., City Mall Surveillance"
            value={form.projectName}
            onChange={(e) => update('projectName', e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Project Type</label>
          <div className="grid grid-cols-2 gap-2">
            {projectTypes.map((pt) => (
              <button
                key={pt.value}
                onClick={() => update('projectType', pt.value)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  form.projectType === pt.value
                    ? 'bg-violet-50 border-violet-300 text-violet-700'
                    : 'bg-white border-gray-100 text-gray-500'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Total Items</label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                placeholder="0"
                value={form.totalItems}
                onChange={(e) => update('totalItems', e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Value (BDT)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                placeholder="0"
                value={form.projectValue}
                onChange={(e) => update('projectValue', e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Client Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <User className="w-4 h-4 text-violet-500" />
          Client Info
        </h2>

        <div>
          <label className={labelClass}>Client Name *</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Client or company name"
              value={form.clientName}
              onChange={(e) => update('clientName', e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Phone</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              placeholder="01XXXXXXXXX"
              value={form.clientPhone}
              onChange={(e) => update('clientPhone', e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              placeholder="client@email.com"
              value={form.clientEmail}
              onChange={(e) => update('clientEmail', e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Client Address</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <textarea
              placeholder="Client office address"
              value={form.clientAddress}
              onChange={(e) => update('clientAddress', e.target.value)}
              rows={2}
              className={`${inputClass} pl-9 resize-none`}
            />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-500" />
          Timeline
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => update('startDate', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => update('deadline', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Site Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-violet-500" />
          Site Details
        </h2>

        <div>
          <label className={labelClass}>Site Address</label>
          <textarea
            placeholder="Installation site address"
            value={form.siteAddress}
            onChange={(e) => update('siteAddress', e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Site Contact</label>
            <input
              type="text"
              placeholder="Name"
              value={form.siteContact}
              onChange={(e) => update('siteContact', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Contact Phone</label>
            <input
              type="tel"
              placeholder="Phone"
              value={form.siteContactPhone}
              onChange={(e) => update('siteContactPhone', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-violet-500" />
          Notes
        </h2>
        <div>
          <label className={labelClass}>Client Notes</label>
          <textarea
            placeholder="Notes visible to the client"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>
        <div>
          <label className={labelClass}>Internal Notes</label>
          <textarea
            placeholder="Internal team notes"
            value={form.internalNotes}
            onChange={(e) => update('internalNotes', e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving || !form.projectName.trim() || !form.clientName.trim()}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/25 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Creating...' : 'Create Project'}
      </button>
    </motion.div>
  );
}