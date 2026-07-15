'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/stores/auth-store';
import { moduleRegistry } from '@/lib/modules';

/* ─── Lazy-loaded module shells ─── */
const MSDashboard = dynamic(
  () => import('@/modules/mobile-shop/components/MSShell').then((mod) => {
    const Comp = mod.MSShell ?? mod.default;
    if (!Comp) console.error('[module-loader] MSShell export not found. Available:', Object.keys(mod));
    return { default: Comp };
  }),
  { loading: () => <ModuleLoadingSkeleton />, ssr: false }
);

const PharmacyDashboard = dynamic(
  () => import('@/modules/pharmacy/components/PharmacyShell').then((mod) => ({
    default: mod.PharmacyShell ?? mod.default,
  })),
  { loading: () => <ModuleLoadingSkeleton />, ssr: false }
);

const CCTVDashboard = dynamic(
  () => import('@/modules/cctv-shop/components/CCTVShell').then((mod) => ({
    default: mod.CCTVShell ?? mod.default,
  })),
  { loading: () => <ModuleLoadingSkeleton />, ssr: false }
);

/* ─── Module Shell Renderer ───
 * Renders the correct module shell based on business type slug.
 * Add new modules here as they are built.
 */
export function ModuleShellRenderer() {
  const session = useAuthStore((s) => s.session);
  if (!session) return null;
  const slug = session.business.businessType.slug;

  switch (slug) {
    case 'mobile-shop':
      return <MSDashboard />;
    case 'pharmacy':
      return <PharmacyDashboard />;
    case 'cctv-shop':
      return <CCTVDashboard />;
    default: {
      const mod = moduleRegistry.find((m) => m.slug === slug);
      return (
        <div className="min-h-screen bg-gray-50/80 flex items-center justify-center">
          <div className="text-center px-6">
            <div className={`w-16 h-16 rounded-2xl ${mod?.bgColor || 'bg-gray-100'} flex items-center justify-center mx-auto mb-4`}>
              <span className="text-3xl">{mod?.icon || '📦'}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">{mod?.name || slug} Module</h2>
            <p className="text-sm text-gray-500 mt-1">Coming soon</p>
          </div>
        </div>
      );
    }
  }
}

/* ─── Loading skeleton shown while module loads ─── */
function ModuleLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header skeleton */}
      <div className="bg-white p-4 border-b border-gray-100">
        <div className="h-6 w-32 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-4 w-48 bg-gray-100 rounded mt-2 animate-pulse" />
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    </div>
  );
}