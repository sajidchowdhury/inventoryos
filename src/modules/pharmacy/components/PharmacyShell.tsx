"use client";

import { useNavStore } from "@/lib/nav-store";
import { PharmacyDashboard } from "./PharmacyDashboard";
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
import { TransactionLog } from "./TransactionLog";
import { CategoryManager } from "./CategoryManager";
import { CsvImport } from "./CsvImport";
import { ProfileView } from "./ProfileView";
import { BottomNav } from "./BottomNav";

export function PharmacyShell() {
  const activeView = useNavStore((s) => s.activeView);

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return <PharmacyDashboard />;
      case "products":
        return <ProductList />;
      case "product-detail":
        return <ProductDetail />;
      case "add-product":
        return <ProductForm mode="add" />;
      case "edit-product":
        return <ProductForm mode="edit" />;
      case "batches":
        return <BatchList />;
      case "add-batch":
        return <BatchForm mode="add" />;
      case "edit-batch":
        return <BatchForm mode="edit" />;
      case "dispense":
        return <QuickDispense />;
      case "sales":
        return <SalesList />;
      case "sale-detail":
        return <SaleDetail />;
      case "analytics":
        return <SalesAnalytics />;
      case "customers":
        return <CustomerManager />;
      case "customer-detail":
        return <CustomerCreditView />;
      case "add-customer":
        return <CustomerManager />;
      case "edit-customer":
        return <CustomerManager />;
      case "customer-credit":
        return <CustomerCreditView />;
      case "payments":
        return <PaymentManager />;
      case "returns":
        return <ReturnsManager />;
      case "discount-rules":
        return <DiscountRulesManager />;
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
      case "expiry":
        return <ExpiryDashboard />;
      case "alerts":
        return <AlertsCenter />;
      case "alert-settings":
        return <AlertPreferences />;
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
      case "transactions":
        return <TransactionLog />;
      case "categories":
        return <CategoryManager />;
      case "import":
        return <CsvImport />;
      case "profile":
        return <ProfileView />;
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
