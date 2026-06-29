"use client";

import { useNavStore } from "@/lib/nav-store";
import { PharmacyDashboard } from "./PharmacyDashboard";
import { InventoryHub } from "./InventoryHub";
import { ReportsHub } from "./ReportsHub";
import { MoreHub } from "./MoreHub";
import { ProductList } from "./ProductList";
import { ProductDetail } from "./ProductDetail";
import { ProductForm } from "./ProductForm";
import { BatchList } from "./BatchList";
import { BatchForm } from "./BatchForm";
import { QuickDispense } from "./QuickDispense";
import { SalesList } from "./SalesList";
import { SaleDetail } from "./SaleDetail";
import { SalesAnalytics } from "./SalesAnalytics";
import { CustomerManager } from "./CustomerManager";
import { CustomerCreditView } from "./CustomerCreditView";
import { PaymentManager } from "./PaymentManager";
import { ReturnsManager } from "./ReturnsManager";
import { DiscountRulesManager } from "./DiscountRulesManager";
import { SupplierManager } from "./SupplierManager";
import { SupplierDetailView } from "./SupplierDetailView";
import { PurchaseList } from "./PurchaseList";
import { PurchaseForm } from "./PurchaseForm";
import { PurchaseDetail } from "./PurchaseDetail";
import { ExpiryDashboard } from "./ExpiryDashboard";
import { AlertsCenter } from "./AlertsCenter";
import { AlertPreferences } from "./AlertPreferences";
import { ExpiryReport } from "./ExpiryReport";
import { BusinessDashboard } from "./BusinessDashboard";
import { ProfitLossReport } from "./ProfitLossReport";
import { InventoryValuationReport } from "./InventoryValuationReport";
import { BusinessReportCenter } from "./BusinessReportCenter";
import { TaxReport } from "./TaxReport";
import { AuditTrail } from "./AuditTrail";
import { DataExport } from "./DataExport";
import { UserManagement } from "./UserManagement";
import { SessionManager } from "./SessionManager";
import { LoginActivity } from "./LoginActivity";
import { AIInsights } from "./AIInsights";
import { AIChat } from "./AIChat";
import { AIHub } from "./AIHub";
import { ReorderSuggestions } from "./ReorderSuggestions";
import { DemandForecast } from "./DemandForecast";
import { ExpiryOptimizer } from "./ExpiryOptimizer";
import { ProfileView } from "./ProfileView";
import { SubscriptionStatus } from "./SubscriptionStatus";
import { BottomNav } from "./BottomNav";

export function PharmacyShell() {
  const activeView = useNavStore((s) => s.activeView);

  const renderView = () => {
    switch (activeView) {
      // ── HUBS ──
      case "dashboard":
        return <PharmacyDashboard />;
      case "inventory-hub":
        return <InventoryHub />;
      case "ai-hub":
        return <AIHub />;
      case "reports-hub":
        return <ReportsHub />;
      case "more-hub":
        return <MoreHub />;

      // ── PRODUCTS ──
      case "products":
        return <ProductList />;
      case "product-detail":
        return <ProductDetail />;
      case "add-product":
        return <ProductForm mode="add" />;
      case "edit-product":
        return <ProductForm mode="edit" />;

      // ── BATCHES ──
      case "batches":
        return <BatchList />;
      case "add-batch":
        return <BatchForm mode="add" />;
      case "edit-batch":
        return <BatchForm mode="edit" />;

      // ── SALES ──
      case "dispense":
        return <QuickDispense />;
      case "sales":
        return <SalesList />;
      case "sale-detail":
        return <SaleDetail />;

      // ── ANALYTICS ──
      case "analytics":
        return <SalesAnalytics />;

      // ── CUSTOMERS ──
      case "customers":
      case "add-customer":
      case "edit-customer":
        return <CustomerManager />;
      case "customer-detail":
      case "customer-credit":
        return <CustomerCreditView />;

      // ── PAYMENTS & RETURNS ──
      case "payments":
        return <PaymentManager />;
      case "returns":
        return <ReturnsManager />;
      case "discount-rules":
        return <DiscountRulesManager />;

      // ── SUPPLIERS & PURCHASES ──
      case "suppliers":
        return <SupplierManager />;
      case "supplier-detail":
        return <SupplierDetailView />;
      case "purchases":
        return <PurchaseList />;
      case "purchase-detail":
        return <PurchaseDetail />;
      case "add-purchase":
        return <PurchaseForm />;

      // ── EXPIRY ──
      case "expiry":
        return <ExpiryDashboard />;

      // ── ALERTS ──
      case "alerts":
        return <AlertsCenter />;
      case "alert-settings":
        return <AlertPreferences />;

      // ── REPORTS ──
      case "report":
        return <ExpiryReport />;
      case "business-dashboard":
        return <BusinessDashboard />;
      case "profit-loss":
        return <ProfitLossReport />;
      case "inventory-value":
        return <InventoryValuationReport />;
      case "business-report":
        return <BusinessReportCenter />;
      case "tax-report":
        return <TaxReport />;
      case "audit-trail":
        return <AuditTrail />;
      case "data-export":
        return <DataExport />;

      // ── USERS ──
      case "users":
        return <UserManagement />;
      case "sessions":
        return <SessionManager />;
      case "login-activity":
        return <LoginActivity />;

      // ── CATEGORIES & IMPORT ──
      case "categories":
        return <CategoryManagerLazy />;
      case "import":
        return <CsvImportLazy />;

      // ── AI ──
      case "ai-insights":
        return <AIInsights />;
      case "ai-chat":
        return <AIChat />;
      case "ai-reorder":
        return <ReorderSuggestions />;
      case "ai-forecast":
        return <DemandForecast />;
      case "ai-expiry-opt":
        return <ExpiryOptimizer />;

      // ── PROFILE ──
      case "profile":
        return <ProfileView />;

      // ── SUBSCRIPTION ──
      case "subscription":
        return <SubscriptionStatus />;

      default:
        return <PharmacyDashboard />;
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 pb-16">
        {renderView()}
      </div>
      <BottomNav />
    </div>
  );
}

// Lazy imports to avoid circular dependencies
import { CategoryManager } from "./CategoryManager";
import { CsvImport } from "./CsvImport";
import { TransactionLog } from "./TransactionLog";

function CategoryManagerLazy() { return <CategoryManager />; }
function CsvImportLazy() { return <CsvImport />; }
