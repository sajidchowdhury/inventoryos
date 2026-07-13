'use client';

import React, { useEffect } from 'react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { startOfflineListeners } from '@/lib/offline-sync';
import { OfflineIndicator } from './OfflineIndicator';
import { MSDashboard } from './MSDashboard';
import { MSBottomNav } from './MSBottomNav';
import { MSDesktopSidebar } from './MSDesktopSidebar';
import { CommandPalette, useMSCommands } from '@/components/CommandPalette';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { MSInventoryHub } from './MSInventoryHub';
import { MSAIHub } from './MSAIHub';
import { MSMoreHub } from './MSMoreHub';
import { MSProductsList } from './MSProductsList';
import { MSProductForm } from './MSProductForm';
import { MSProductDetail } from './MSProductDetail';
import { MSSerialItemsList } from './MSSerialItemsList';
import { MSSellView } from './MSSellView';
import { MSJobCardsList } from './MSJobCardsList';
import { MSWarrantiesList } from './MSWarrantiesList';
import { MSProjectsList } from './MSProjectsList';
import { MSEMIList } from './MSEMIList';
import { MSAMCList } from './MSAMCList';
import { MSCustomersList } from './MSCustomersList';
import { MSProfileView } from './MSProfileView';
import { MSStockInView } from './MSStockInView';
import { MSBranchesList } from './MSBranchesList';
import { MSBranchDetail } from './MSBranchDetail';
import { MSTransfersList } from './MSTransfersList';
import { MSCreateTransfer } from './MSCreateTransfer';
import { MSTransferDetail } from './MSTransferDetail';
import { MSKitsList } from './MSKitsList';
import { MSKitDetail } from './MSKitDetail';
import { MSKitForm } from './MSKitForm';
import { MSSellKitView } from './MSSellKitView';
import { MSJobCardDetail } from './MSJobCardDetail';
import { MSCreateJobCard } from './MSCreateJobCard';
import { MSTechniciansList } from './MSTechniciansList';
import { MSTechnicianDetail } from './MSTechnicianDetail';
import { MSCommissionReport } from './MSCommissionReport';
import { MSSalesHistory } from './MSSalesHistory';
import { MSSaleDetail } from './MSSaleDetail';
import { MSEmiDetail } from './MSEmiDetail';
import { MSCreatEmi } from './MSCreatEmi';
import { MSCustomerDetail } from './MSCustomerDetail';
import { MSLoyaltyCenter } from './MSLoyaltyCenter';
import { MSWarrantyDetail } from './MSWarrantyDetail';
import { MSAmcDetail } from './MSAmcDetail';
import { MSCreateAmc } from './MSCreateAmc';
import { MSCreateProject } from './MSCreateProject';
import { MSProjectDetail } from './MSProjectDetail';
import { MSStorageCalculator } from './MSStorageCalculator';
import { MSInstallationTasks } from './MSInstallationTasks';
import { MSCreateTask } from './MSCreateTask';
import { MSTaskDetail } from './MSTaskDetail';
import { MSNbrSetup } from './MSNbrSetup';
import { MSMushakInvoicesList } from './MSMushakInvoicesList';
import { MSMushakInvoiceDetail } from './MSMushakInvoiceDetail';
import { MSMushakRegisters } from './MSMushakRegisters';
import { MSVatReturn } from './MSVatReturn';
import { MSCloudDashboard } from './MSCloudDashboard';
import { MSDueBook } from './MSDueBook';
import { MSExpenseView } from './MSExpenseView';
import { MSLedgerView } from './MSLedgerView';
import { MSProfitLossReport } from './MSProfitLossReport';
import { MSStockReport } from './MSStockReport';
import { MSSupplierView } from './MSSupplierView';
import { MSCategoryList } from './MSCategoryList';
import { MSCategoryForm } from './MSCategoryForm';
import { MSSupplierDetail } from './MSSupplierDetail';
import { MSPurchaseOrderView } from './MSPurchaseOrderView';
import { MSCreatePurchase } from './MSCreatePurchase';
import { MSReportsDashboard } from './MSReportsDashboard';
import { MSImportProducts } from './MSImportProducts';

function PlaceholderView({ title, icon }: { title: string; icon?: string }) {
  const { goBack } = useMSNavStore();
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
  'create-emi': { title: 'Create EMI Plan', icon: '➕' },
  'amc-detail': { title: 'AMC Details', icon: '📋' },
  'create-amc': { title: 'Create AMC', icon: '➕' },
  'purchase-orders': { title: 'Purchase Orders', icon: '🛒' },
  'suppliers': { title: 'Suppliers', icon: '🏭' },
  'supplier-detail': { title: 'Supplier Details', icon: '🏭' },
  'create-purchase': { title: 'New Purchase', icon: '➕' },
  'purchase-detail': { title: 'Purchase Detail', icon: '📋' },
  'branches': { title: 'Branches', icon: '🏪' },
  'branch-detail': { title: 'Branch Details', icon: '📍' },
  'transfers': { title: 'Transfers', icon: '🚚' },
  'create-transfer': { title: 'New Transfer', icon: '📤' },
  'transfer-detail': { title: 'Transfer Details', icon: '📋' },
  'kits': { title: 'Kits & Bundles', icon: '📦' },
  'kit-detail': { title: 'Kit Details', icon: '📦' },
  'create-kit': { title: 'New Kit', icon: '➕' },
  'edit-kit': { title: 'Edit Kit', icon: '✏️' },
  'sell-kit': { title: 'Sell Kit', icon: '🛒' },
  'import-products': { title: 'Import Products', icon: '📥' },
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
  'loyalty-center': { title: 'Loyalty Program', icon: '⭐' },
  'storage-calculator': { title: 'Storage Calculator', icon: '💾' },
  'installation-tasks': { title: 'Installation Tasks', icon: '📋' },
  'create-task': { title: 'New Task', icon: '➕' },
  'task-detail': { title: 'Task Details', icon: '🔧' },
  'nbr-setup': { title: 'NBR & Tax Setup', icon: '🏛️' },
  'mushak-invoices': { title: 'Mushak 6.3 Invoices', icon: '📄' },
  'mushak-invoice-detail': { title: 'Invoice Detail', icon: '📄' },
  'mushak-registers': { title: 'Mushak Registers', icon: '📊' },
  'create-mushak': { title: 'Generate Mushak', icon: '➕' },
  'vat-return': { title: 'Mushak 9.1 VAT Return', icon: '🏛️' },
  'cloud-dashboard': { title: 'Cloud Dashboard', icon: '📊' },
  'due-book': { title: 'Due Book', icon: '📒' },
  'expenses': { title: 'Expenses', icon: '💸' },
  'ledger': { title: 'Financial Ledger', icon: '📒' },
  'stock-report': { title: 'Stock Report', icon: '📦' },
  'profit-loss': { title: 'Profit & Loss', icon: '📊' },
  'categories': { title: 'Categories', icon: '🏷️' },
  'create-category': { title: 'Create Category', icon: '➕' },
  'edit-category': { title: 'Edit Category', icon: '✏️' },
};

export function MSShell() {
  const { activeView, navigate } = useMSNavStore();

  // ── Desktop power features (Phase 4D) ──
  const commands = useMSCommands(navigate as (view: string, contextId?: string) => void);
  useKeyboardShortcuts({
    onNewProduct: () => navigate('add-product'),
    onNewSale: () => navigate('sell'),
  });

  // Start offline listeners on mount (online/offline detection + auto-sync)
  useEffect(() => {
    const cleanup = startOfflineListeners();
    return cleanup;
  }, []);

  const renderView = () => {
    switch (activeView) {
      // Hubs
      case 'dashboard':
        return <MSDashboard />;
      case 'inventory-hub':
        return <MSInventoryHub />;
      case 'sell':
        return <MSSellView />;
      case 'ai-hub':
        return <MSAIHub />;
      case 'more-hub':
        return <MSMoreHub />;
      // Core views
      case 'products':
        return <MSProductsList />;
      case 'add-product':
      case 'edit-product':
        return <MSProductForm />;
      case 'product-detail':
        return <MSProductDetail />;
      case 'serial-items':
        return <MSSerialItemsList />;
      case 'stock-in':
        return <MSStockInView />;
      case 'branches':
        return <MSBranchesList />;
      case 'branch-detail':
        return <MSBranchDetail />;
      case 'transfers':
        return <MSTransfersList />;
      case 'create-transfer':
        return <MSCreateTransfer />;
      case 'transfer-detail':
        return <MSTransferDetail />;
      case 'kits':
        return <MSKitsList />;
      case 'kit-detail':
        return <MSKitDetail />;
      case 'create-kit':
      case 'edit-kit':
        return <MSKitForm />;
      case 'sell-kit':
        return <MSSellKitView />;
      case 'job-cards':
        return <MSJobCardsList />;
      case 'job-card-detail':
        return <MSJobCardDetail />;
      case 'create-job-card':
        return <MSCreateJobCard />;
      case 'warranties':
        return <MSWarrantiesList />;
      case 'projects':
        return <MSProjectsList />;
      case 'project-detail':
        return <MSProjectDetail />;
      case 'create-project':
        return <MSCreateProject />;
      case 'emi':
        return <MSEMIList />;
      case 'amc':
        return <MSAMCList />;
      case 'amc-detail':
        return <MSAmcDetail />;
      case 'create-amc':
        return <MSCreateAmc />;
      case 'customers':
        return <MSCustomersList />;
      case 'purchase-orders':
        return <MSPurchaseOrderView />;
      case 'create-purchase':
        return <MSCreatePurchase />;
      case 'suppliers':
        return <MSSupplierView />;
      case 'supplier-detail':
        return <MSSupplierDetail />;
      case 'profile':
        return <MSProfileView />;
      // Technician & Commissions (2C)
      case 'technicians':
        return <MSTechniciansList />;
      case 'technician-detail':
        return <MSTechnicianDetail />;
      case 'commission-report':
        return <MSCommissionReport />;
      case 'emi-detail':
        return <MSEmiDetail />;
      case 'create-emi':
        return <MSCreatEmi />;
      // Payment & Sales (3A)
      case 'new-sale':
        return <MSSellView />;
      case 'sales-history':
        return <MSSalesHistory />;
      case 'sale-detail':
        return <MSSaleDetail />;
      // Customer Loyalty & CRM (3C)
      case 'customer-detail':
        return <MSCustomerDetail />;
      case 'loyalty-center':
        return <MSLoyaltyCenter />;
      // Storage Calculator (4B)
      case 'storage-calculator':
        return <MSStorageCalculator />;
      // Installation Tasks (4D)
      case 'installation-tasks':
        return <MSInstallationTasks />;
      case 'create-task':
        return <MSCreateTask />;
      case 'task-detail':
        return <MSTaskDetail />;
      // Warranty Tracking & Alerts (3D)
      case 'warranty-detail':
        return <MSWarrantyDetail />;
      // NBR Compliance – BIN Setup (5A)
      case 'nbr-setup':
        return <MSNbrSetup />;
      // Mushak 6.3 Tax Invoice (5B)
      case 'mushak-invoices':
        return <MSMushakInvoicesList />;
      case 'mushak-invoice-detail':
        return <MSMushakInvoiceDetail />;
      case 'mushak-registers':
        return <MSMushakRegisters />;
      // Mushak Report — redirects to Mushak Registers (6.1 & 6.2)
      case 'mushak-report':
        return <MSMushakRegisters />;
      // Monthly VAT Return – Mushak 9.1 (5D)
      case 'vat-return':
        return <MSVatReturn />;
      // Cloud Dashboard (7C)
      case 'cloud-dashboard':
        return <MSCloudDashboard />;
      // Due Book (2B)
      case 'due-book':
        return <MSDueBook />;
      // Expenses (2D)
      case 'expenses':
        return <MSExpenseView />;
      // Financial Ledger (3A)
      case 'ledger':
        return <MSLedgerView />;
      // Stock Report
      case 'stock-report':
        return <MSStockReport />;
      // Profit & Loss Report (3B)
      case 'profit-loss':
        return <MSProfitLossReport />;
      // Category Management
      case 'categories':
        return <MSCategoryList />;
      case 'create-category':
      case 'edit-category':
        return <MSCategoryForm />;
      // All Reports Dashboard
      case 'reports':
        return <MSReportsDashboard />;
      case 'import-products':
        return <MSImportProducts />;
      default: {
        const meta = viewMeta[activeView];
        return <PlaceholderView title={meta?.title || activeView} icon={meta?.icon} />;
      }
    }
  };

  return (
    <div className="ms-shell-wrap">
      {/* Desktop sidebar (hidden on mobile, shown on md:) */}
      <MSDesktopSidebar />
      <div className="flex flex-col min-h-0 flex-1 md:pl-64">
        <OfflineIndicator />
        <div className="flex-1 pb-20 md:pb-4 px-4 pt-4 max-w-[1200px] mx-auto w-full">
          {renderView()}
        </div>
        {/* Bottom nav (shown on mobile, hidden on md:) */}
        <div className="md:hidden">
          <MSBottomNav />
        </div>
      </div>
      {/* Command palette (desktop only, triggered by Cmd+K / Ctrl+K) */}
      <CommandPalette commands={commands} />
    </div>
  );
}