'use client';

import React from 'react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import CCTVDashboard from './CCTVDashboard';
import CCTVBottomNav from './CCTVBottomNav';
import CCTVInventoryHub from './CCTVInventoryHub';
import CCTVAIHub from './CCTVAIHub';
import CCTVMoreHub from './CCTVMoreHub';

function PlaceholderView({ title }: { title: string }) {
  const { goBack } = useCCTVNavStore();
  return (
    <div className="px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
          <span className="text-2xl">🔧</span>
        </div>
        <p className="text-sm font-semibold text-gray-800">Coming Soon</p>
        <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
          This feature is being built. Stay tuned!
        </p>
      </div>
    </div>
  );
}

const viewLabels: Record<string, string> = {
  'new-sale': 'New Sale',
  'products': 'Products',
  'serial-items': 'Serial Items',
  'add-product': 'Add Product',
  'edit-product': 'Edit Product',
  'product-detail': 'Product Details',
  'sale-detail': 'Sale Details',
  'sales-history': 'Sales History',
  'customers': 'Customers',
  'customer-detail': 'Customer Details',
  'job-cards': 'Job Cards',
  'job-card-detail': 'Job Card Details',
  'create-job-card': 'Create Job Card',
  'warranties': 'Warranties',
  'warranty-detail': 'Warranty Details',
  'projects': 'Projects',
  'project-detail': 'Project Details',
  'create-project': 'Create Project',
  'emi': 'EMI Tracking',
  'emi-detail': 'EMI Details',
  'amc': 'AMC Management',
  'amc-detail': 'AMC Details',
  'create-amc': 'Create AMC',
  'mushak-report': 'Mushak Report',
  'purchase-orders': 'Purchase Orders',
  'suppliers': 'Suppliers',
  'ai-chat': 'AI Chat',
  'ai-insights': 'AI Insights',
  'settings': 'Settings',
  'profile': 'Profile',
  'subscription': 'Subscription',
  'reports': 'Reports',
  'help': 'Help & Support',
};

export default function CCTVShell() {
  const { activeView } = useCCTVNavStore();

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <CCTVDashboard />;
      case 'inventory-hub':
        return <CCTVInventoryHub />;
      case 'ai-hub':
        return <CCTVAIHub />;
      case 'more-hub':
        return <CCTVMoreHub />;
      default:
        return <PlaceholderView title={viewLabels[activeView] || activeView} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      <main className="max-w-lg mx-auto">
        {renderView()}
      </main>
      <CCTVBottomNav />
    </div>
  );
}