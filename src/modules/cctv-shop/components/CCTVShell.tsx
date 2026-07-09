'use client';

import React from 'react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { CCTVDashboard } from './CCTVDashboard';
import { CCTVBottomNav } from './CCTVBottomNav';
import { CCTVInventoryHub } from './CCTVInventoryHub';
import { CCTVAIHub } from './CCTVAIHub';
import { CCTVMoreHub } from './CCTVMoreHub';
import { CCTVProductsList } from './CCTVProductsList';
import { CCTVProductForm } from './CCTVProductForm';
import { CCTVProductDetail } from './CCTVProductDetail';
import { CCTVSerialItemsList } from './CCTVSerialItemsList';
import { CCTVSellView } from './CCTVSellView';
import { CCTVJobCardsList } from './CCTVJobCardsList';
import { CCTVWarrantiesList } from './CCTVWarrantiesList';
import { CCTVProjectsList } from './CCTVProjectsList';
import { CCTVEMIList } from './CCTVEMIList';
import { CCTVAMCList } from './CCTVAMCList';
import { CCTVCustomersList } from './CCTVCustomersList';
import { CCTVProfileView } from './CCTVProfileView';
import { CCTVStockInView } from './CCTVStockInView';
import { CCTVBranchesList } from './CCTVBranchesList';
import { CCTVBranchDetail } from './CCTVBranchDetail';
import { CCTVTransfersList } from './CCTVTransfersList';
import { CCTVCreateTransfer } from './CCTVCreateTransfer';
import { CCTVTransferDetail } from './CCTVTransferDetail';
import { CCTVKitsList } from './CCTVKitsList';
import { CCTVKitDetail } from './CCTVKitDetail';
import { CCTVKitForm } from './CCTVKitForm';
import { CCTVJobCardDetail } from './CCTVJobCardDetail';
import { CCTVCreateJobCard } from './CCTVCreateJobCard';
import { CCTVTechniciansList } from './CCTVTechniciansList';
import { CCTVTechnicianDetail } from './CCTVTechnicianDetail';
import { CCTVCommissionReport } from './CCTVCommissionReport';

function PlaceholderView({ title, icon }: { title: string; icon?: string }) {
  const { goBack } = useCCTVNavStore();
  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
          <span className="text-2xl">{icon || '🔧'}</span>
        </div>
        <p className="text-sm font-semibold text-gray-800">Coming Soon</p>
        <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
          This feature is being built. Stay tuned!
        </p>
      </div>
    </div>
  );
}

const viewMeta: Record<string, { title: string; icon: string }> = {
  'new-sale': { title: 'New Sale', icon: '🛒' },
  'stock-in': { title: 'Stock In', icon: '📥' },
  'add-product': { title: 'Add Product', icon: '➕' },
  'edit-product': { title: 'Edit Product', icon: '✏️' },
  'product-detail': { title: 'Product Details', icon: '📦' },
  'sale-detail': { title: 'Sale Details', icon: '🧾' },
  'customer-detail': { title: 'Customer Details', icon: '👤' },
  'job-card-detail': { title: 'Job Card Details', icon: '🔧' },
  'create-job-card': { title: 'Create Job Card', icon: '➕' },
  'warranty-detail': { title: 'Warranty Details', icon: '🛡️' },
  'project-detail': { title: 'Project Details', icon: '🏗️' },
  'create-project': { title: 'Create Project', icon: '➕' },
  'emi-detail': { title: 'EMI Details', icon: '💳' },
  'amc-detail': { title: 'AMC Details', icon: '📋' },
  'create-amc': { title: 'Create AMC', icon: '➕' },
  'purchase-orders': { title: 'Purchase Orders', icon: '🛒' },
  'suppliers': { title: 'Suppliers', icon: '🏭' },
  'branches': { title: 'Branches', icon: '🏪' },
  'branch-detail': { title: 'Branch Details', icon: '📍' },
  'transfers': { title: 'Transfers', icon: '🚚' },
  'create-transfer': { title: 'New Transfer', icon: '📤' },
  'transfer-detail': { title: 'Transfer Details', icon: '📋' },
  'kits': { title: 'Kits & Bundles', icon: '📦' },
  'kit-detail': { title: 'Kit Details', icon: '📦' },
  'create-kit': { title: 'New Kit', icon: '➕' },
  'edit-kit': { title: 'Edit Kit', icon: '✏️' },
  'ai-chat': { title: 'AI Chat', icon: '🤖' },
  'ai-insights': { title: 'AI Insights', icon: '📊' },
  'sales-history': { title: 'Sales History', icon: '📈' },
  'mushak-report': { title: 'Mushak Report', icon: '📑' },
  'reports': { title: 'Reports', icon: '📊' },
  'technicians': { title: 'Technicians', icon: '👨‍🔧' },
  'technician-detail': { title: 'Technician Details', icon: '👨‍🔧' },
  'commission-report': { title: 'Commission Report', icon: '💰' },
  'settings': { title: 'Settings', icon: '⚙️' },
  'help': { title: 'Help & Support', icon: '💬' },
  'subscription': { title: 'Subscription', icon: '👑' },
};

export function CCTVShell() {
  const { activeView } = useCCTVNavStore();

  const renderView = () => {
    switch (activeView) {
      // Hubs
      case 'dashboard':
        return <CCTVDashboard />;
      case 'inventory-hub':
        return <CCTVInventoryHub />;
      case 'sell':
        return <CCTVSellView />;
      case 'ai-hub':
        return <CCTVAIHub />;
      case 'more-hub':
        return <CCTVMoreHub />;
      // Core views
      case 'products':
        return <CCTVProductsList />;
      case 'add-product':
      case 'edit-product':
        return <CCTVProductForm />;
      case 'product-detail':
        return <CCTVProductDetail />;
      case 'serial-items':
        return <CCTVSerialItemsList />;
      case 'stock-in':
        return <CCTVStockInView />;
      case 'branches':
        return <CCTVBranchesList />;
      case 'branch-detail':
        return <CCTVBranchDetail />;
      case 'transfers':
        return <CCTVTransfersList />;
      case 'create-transfer':
        return <CCTVCreateTransfer />;
      case 'transfer-detail':
        return <CCTVTransferDetail />;
      case 'kits':
        return <CCTVKitsList />;
      case 'kit-detail':
        return <CCTVKitDetail />;
      case 'create-kit':
      case 'edit-kit':
        return <CCTVKitForm />;
      case 'job-cards':
        return <CCTVJobCardsList />;
      case 'job-card-detail':
        return <CCTVJobCardDetail />;
      case 'create-job-card':
        return <CCTVCreateJobCard />;
      case 'warranties':
        return <CCTVWarrantiesList />;
      case 'projects':
        return <CCTVProjectsList />;
      case 'emi':
        return <CCTVEMIList />;
      case 'amc':
        return <CCTVAMCList />;
      case 'customers':
        return <CCTVCustomersList />;
      case 'profile':
        return <CCTVProfileView />;
      // Technician & Commissions (2C)
      case 'technicians':
        return <CCTVTechniciansList />;
      case 'technician-detail':
        return <CCTVTechnicianDetail />;
      case 'commission-report':
        return <CCTVCommissionReport />;
      default: {
        const meta = viewMeta[activeView];
        return <PlaceholderView title={meta?.title || activeView} icon={meta?.icon} />;
      }
    }
  };

  return (
    <div className="cctv-shell-wrap">
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex-1 pb-20 px-4 pt-4">
          {renderView()}
        </div>
        <CCTVBottomNav />
      </div>
    </div>
  );
}